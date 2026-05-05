import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// In-memory token store — persists per serverless instance
// For production, store tokens in Supabase sessions table
const tokenStore = new Map<string, object>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    // Upsert user
    await supabase.from("users").upsert({ id: userId, github_id: String(ghUser.id), username: ghUser.login, avatar_url: ghUser.avatar_url });

    // Create trial subscription if new user
    const { data: existingSub } = await supabase.from("subscriptions").select("id").eq("user_id", userId).single();
    if (!existingSub) {
      const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 7);
      await supabase.from("subscriptions").insert({ id: `sub_${userId}`, user_id: userId, plan: "trial", status: "active", trial_ends_at: trialEnd.toISOString() });
    }

    // Store session token in Supabase so it survives across serverless instances
    const token = crypto.randomBytes(32).toString("hex");
    await supabase.from("auth_tokens").upsert({
      token, user_id: userId, username: ghUser.login,
      avatar_url: ghUser.avatar_url, created_at: new Date().toISOString()
    });

    res.redirect(`${process.env.FRONTEND_URL}/?token=${token}&username=${ghUser.login}&avatar=${encodeURIComponent(ghUser.avatar_url)}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Auth failed");
  }
}
