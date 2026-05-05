import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });

  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data } = await supabase.from("session_buffer").select("chunk, created_at").eq("session_id", session_id).gte("created_at", since).order("created_at");

  res.json(data ?? []);
}
