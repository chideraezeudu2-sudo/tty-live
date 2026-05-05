import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

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
  const { id } = req.query;

  if (req.method === "DELETE") {
    await supabase.from("sessions").delete().eq("id", id).eq("user_id", user.user_id);
    return res.json({ success: true });
  }

  if (req.method === "PATCH") {
    // Stop session
    const { status } = req.body;
    if (status === "completed") {
      await supabase.from("sessions").update({ status: "completed", end_time: new Date().toISOString() }).eq("id", id).eq("user_id", user.user_id);
      // Broadcast stop event via Supabase Realtime by inserting a terminal event
      await supabase.from("terminal_events").insert({ session_id: id, type: "session_stopped", data: "{}", created_at: new Date().toISOString() });
    }
    return res.json({ success: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
