import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const { data: authData } = await supabase.from("auth_tokens").select("user_id").eq("token", token).single();
  if (!authData) return res.status(401).json({ error: "Unauthorized" });

  const { data: sessions } = await supabase.from("sessions").select("start_time,end_time,peak_viewers").eq("user_id", authData.user_id);
  res.json({
    totalSessions: sessions?.length ?? 0,
    totalMinutes: sessions?.reduce((a, s) => s.end_time ? a + Math.floor((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000) : a, 0) ?? 0,
    totalViewers: sessions?.reduce((a, s) => a + (s.peak_viewers ?? 0), 0) ?? 0,
  });
}
