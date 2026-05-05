import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  const { data } = await supabase.from("sessions").select("status,peak_viewers").eq("id", id).single();
  res.json(data ?? { status: "unknown" });
}
