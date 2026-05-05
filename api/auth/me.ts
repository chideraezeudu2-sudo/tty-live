import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const { data } = await supabase.from("auth_tokens").select("*").eq("token", token).single();
  if (!data) return res.status(401).json({ error: "Invalid token" });
  res.json({ userId: data.user_id, username: data.username, avatarUrl: data.avatar_url });
}
