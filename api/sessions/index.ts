import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function getUser(req: VercelRequest) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return null;
  const { data } = await supabase.from("auth_tokens").select("*").eq("token", token).single();
  return data;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "GET") {
    const { data } = await supabase.from("sessions").select("*").eq("user_id", user.user_id).order("created_at", { ascending: false });
    return res.json(data ?? []);
  }

  if (req.method === "POST") {
    // Start a new session
    const sessionId = crypto.randomBytes(4).toString("hex");
    const name = req.body?.name || `Session ${sessionId}`;
    await supabase.from("sessions").insert({ id: sessionId, user_id: user.user_id, name, status: "active", start_time: new Date().toISOString() });
    const viewerUrl = `${process.env.VIEWER_URL}/view/${sessionId}`;
    return res.json({ id: sessionId, name, viewerUrl, status: "active" });
  }

  res.status(405).json({ error: "Method not allowed" });
}
