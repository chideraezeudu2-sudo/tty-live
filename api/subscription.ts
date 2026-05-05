import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const { data: authData } = await supabase.from("auth_tokens").select("user_id").eq("token", token).single();
  if (!authData) return res.status(401).json({ error: "Unauthorized" });

  const { data } = await supabase.from("subscriptions").select("*").eq("user_id", authData.user_id).single();
  res.json(data ?? { plan: "trial", status: "active" });
}
