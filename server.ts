import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Privacy Shield patterns
const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/g,
  /sk-[a-zA-Z0-9]{32,}/g,
  /ghp_[a-zA-Z0-9]{36}/g,
  /xox[baprs]-[a-zA-Z0-9-]+/g,
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----/g,
  /(?:password|passwd|pwd|secret|token|key)\s*=\s*['"]?[^\s'"]{8,}['"]?/gi,
  /(?:DATABASE_URL|MONGODB_URI|REDIS_URL)=\S+/gi,
];

function applyPrivacyShield(data: string, customPatterns: string[] = []): string {
  let sanitized = data;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  for (const pat of customPatterns) {
    try { sanitized = sanitized.replace(new RegExp(pat, "g"), "[REDACTED]"); } catch {}
  }
  return sanitized;
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

const tokenStore = new Map<string, { userId: string; username: string; avatarUrl: string }>();

function getUserFromToken(req: express.Request) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return tokenStore.get(auth.slice(7)) ?? null;
}

interface LiveSession {
  id: string; userId: string; name: string;
  startTime: string; endTime?: string;
  viewers: number; peakViewers: number;
  status: "active" | "completed";
  buffer: { time: string; data: string }[];
  socketId: string; privacyPatterns: string[];
}

const liveSessions = new Map<string, LiveSession>();
const socketToSession = new Map<string, string>();

async function start() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" } });

  app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  // GitHub OAuth
  app.get("/auth/github", (_req, res) => {
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!,
      redirect_uri: `${process.env.SERVER_URL}/auth/github/callback`,
      scope: "read:user",
    });
    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
  });

  app.get("/auth/github/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("Missing code");
    try {
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code }),
      });
      const tokenData: any = await tokenRes.json();
      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const ghUser: any = await userRes.json();
      const userId = `gh_${ghUser.id}`;

      await supabase.from("users").upsert({ id: userId, github_id: String(ghUser.id), username: ghUser.login, avatar_url: ghUser.avatar_url });

      const { data: existingSub } = await supabase.from("subscriptions").select("id").eq("user_id", userId).single();
      if (!existingSub) {
        const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 7);
        await supabase.from("subscriptions").insert({ id: `sub_${userId}`, user_id: userId, plan: "trial", status: "active", trial_ends_at: trialEnd.toISOString() });
      }

      const token = generateToken();
      tokenStore.set(token, { userId, username: ghUser.login, avatarUrl: ghUser.avatar_url });
      res.redirect(`${process.env.FRONTEND_URL}/?token=${token}&username=${ghUser.login}&avatar=${encodeURIComponent(ghUser.avatar_url)}`);
    } catch (err) {
      console.error(err);
      res.status(500).send("Auth failed");
    }
  });

  app.get("/auth/me", (req, res) => {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    res.json(user);
  });

  app.get("/api/stats", async (req, res) => {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const { data: sessions } = await supabase.from("sessions").select("start_time,end_time,peak_viewers").eq("user_id", user.userId);
    res.json({
      totalSessions: sessions?.length ?? 0,
      totalMinutes: sessions?.reduce((a, s) => s.end_time ? a + Math.floor((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000) : a, 0) ?? 0,
      totalViewers: sessions?.reduce((a, s) => a + (s.peak_viewers ?? 0), 0) ?? 0,
    });
  });

  app.get("/api/sessions", async (req, res) => {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const { data } = await supabase.from("sessions").select("*").eq("user_id", user.userId).order("created_at", { ascending: false });
    res.json(data ?? []);
  });

  app.delete("/api/sessions/:id", async (req, res) => {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    await supabase.from("sessions").delete().eq("id", req.params.id).eq("user_id", user.userId);
    res.json({ success: true });
  });

  app.get("/api/subscription", async (req, res) => {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const { data } = await supabase.from("subscriptions").select("*").eq("user_id", user.userId).single();
    res.json(data ?? { plan: "trial", status: "active" });
  });

  // Stripe
  app.post("/api/billing/create-checkout", async (req, res) => {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const priceId = req.body.plan === "pro" ? process.env.STRIPE_PRO_PRICE_ID : process.env.STRIPE_BASIC_PRICE_ID;
    if (!priceId) return res.status(400).json({ error: "Invalid plan" });
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription", payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.FRONTEND_URL}/?billing=success`,
        cancel_url: `${process.env.FRONTEND_URL}/?billing=cancelled`,
        metadata: { userId: user.userId },
      });
      res.json({ url: session.url });
    } catch (err) { res.status(500).json({ error: "Stripe failed" }); }
  });

  app.get("/api/billing/portal", async (req, res) => {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const { data: sub } = await supabase.from("subscriptions").select("stripe_customer_id").eq("user_id", user.userId).single();
    if (!sub?.stripe_customer_id) return res.status(400).json({ error: "No customer" });
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      const session = await stripe.billingPortal.sessions.create({ customer: sub.stripe_customer_id, return_url: process.env.FRONTEND_URL });
      res.json({ url: session.url });
    } catch { res.status(500).json({ error: "Portal failed" }); }
  });

  app.post("/api/billing/webhook", async (req: any, res) => {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      const event = stripe.webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET!);
      if (event.type === "checkout.session.completed") {
        const s: any = event.data.object;
        if (s.metadata?.userId) {
          await supabase.from("subscriptions").upsert({ id: s.subscription, user_id: s.metadata.userId, stripe_customer_id: s.customer, stripe_subscription_id: s.subscription, plan: "basic", status: "active" });
        }
      }
      if (event.type === "customer.subscription.deleted") {
        const s: any = event.data.object;
        await supabase.from("subscriptions").update({ status: "cancelled", plan: "trial" }).eq("stripe_subscription_id", s.id);
      }
      res.json({ received: true });
    } catch { res.status(400).send("Webhook error"); }
  });

  // WebSocket
  io.on("connection", (socket) => {
    socket.on("start-session", async (data: any) => {
      const sessionId = crypto.randomBytes(4).toString("hex");
      const session: LiveSession = {
        id: sessionId, userId: data.userId ?? "anon", name: data.name || `Session ${sessionId}`,
        startTime: new Date().toISOString(), viewers: 0, peakViewers: 0,
        status: "active", buffer: [], socketId: socket.id, privacyPatterns: data.privacyPatterns ?? [],
      };
      liveSessions.set(sessionId, session);
      socketToSession.set(socket.id, sessionId);
      socket.join(sessionId);
      await supabase.from("sessions").insert({ id: sessionId, user_id: session.userId, name: session.name, status: "active", start_time: session.startTime });
      const viewerUrl = `${process.env.VIEWER_URL}/view/${sessionId}`;
      socket.emit("session-started", { ...session, viewerUrl });
    });

    socket.on("terminal-data", async ({ sessionId, data }: any) => {
      const session = liveSessions.get(sessionId);
      if (!session) return;
      const sanitized = applyPrivacyShield(data, session.privacyPatterns);
      const now = new Date();
      session.buffer.push({ time: now.toISOString(), data: sanitized });
      session.buffer = session.buffer.filter(b => new Date(b.time) > new Date(now.getTime() - 5 * 60 * 1000));
      supabase.from("session_buffer").insert({ session_id: sessionId, chunk: sanitized });
      socket.to(sessionId).emit("terminal-output", sanitized);
    });

    socket.on("stop-session", async (sessionId: string) => {
      const session = liveSessions.get(sessionId);
      if (!session) return;
      session.status = "completed";
      session.endTime = new Date().toISOString();
      await supabase.from("sessions").update({ status: "completed", end_time: session.endTime, peak_viewers: session.peakViewers }).eq("id", sessionId);
      io.to(sessionId).emit("session-stopped", { duration: Math.floor((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000), peakViewers: session.peakViewers });
    });

    socket.on("join-session", async (sessionId: string) => {
      socket.join(sessionId);
      const session = liveSessions.get(sessionId);
      if (session && session.status === "active") {
        session.viewers++;
        session.peakViewers = Math.max(session.peakViewers, session.viewers);
        io.to(sessionId).emit("viewer-count", session.viewers);
        await supabase.from("session_viewers").insert({ session_id: sessionId, socket_id: socket.id });
      } else {
        const { data } = await supabase.from("sessions").select("*").eq("id", sessionId).single();
        if (data?.status === "completed") socket.emit("session-stopped", { duration: 0, peakViewers: data.peak_viewers });
      }
    });

    socket.on("request-rewind", (sessionId: string) => {
      const session = liveSessions.get(sessionId);
      if (session) socket.emit("rewind-data", session.buffer);
    });

    socket.on("highlight-line", ({ sessionId, lineIndex }: any) => {
      const session = liveSessions.get(sessionId);
      if (session) io.to(session.socketId).emit("viewer-highlight", { lineIndex });
    });

    socket.on("leave-session", async (sessionId: string) => {
      socket.leave(sessionId);
      const session = liveSessions.get(sessionId);
      if (session) {
        session.viewers = Math.max(0, session.viewers - 1);
        io.to(sessionId).emit("viewer-count", session.viewers);
        await supabase.from("session_viewers").update({ left_at: new Date().toISOString() }).eq("session_id", sessionId).eq("socket_id", socket.id);
      }
    });

    socket.on("disconnect", async () => {
      const sessionId = socketToSession.get(socket.id);
      if (sessionId) {
        const session = liveSessions.get(sessionId);
        if (session?.status === "active") {
          session.status = "completed";
          session.endTime = new Date().toISOString();
          await supabase.from("sessions").update({ status: "completed", end_time: session.endTime, peak_viewers: session.peakViewers }).eq("id", sessionId);
          io.to(sessionId).emit("session-stopped", { duration: 0, peakViewers: session.peakViewers });
        }
        socketToSession.delete(socket.id);
      }
    });
  });

  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));

  const PORT = parseInt(process.env.PORT ?? "3000");
  httpServer.listen(PORT, "0.0.0.0", () => console.log(`tty.live running on port ${PORT}`));
}

start().catch(console.error);
