import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { session_id, line_index } = req.body;
  const channel = supabase.channel(`host:${session_id}`);
  await channel.send({ type: "broadcast", event: "viewer_highlight", payload: { line_index } });
  res.json({ ok: true });
}
