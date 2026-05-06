import { Handler } from "@netlify/functions";
import { getUser, supabase, cors } from "./utils";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  const user = await getUser(event.headers.authorization);
  if (!user) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Unauthorized" }) };

  const sessionId = event.queryStringParameters?.id;
  if (!sessionId) return { statusCode: 400, headers: cors, body: "Missing id" };

  if (event.httpMethod === "DELETE") {
    await supabase.from("sessions").delete().eq("id", sessionId).eq("user_id", user.user_id);
    return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true }) };
  }

  if (event.httpMethod === "PATCH") {
    const body = JSON.parse(event.body || "{}");
    if (body.status === "completed") {
      await supabase.from("sessions").update({ status: "completed", end_time: new Date().toISOString() }).eq("id", sessionId).eq("user_id", user.user_id);
      // Notify viewers via Supabase Realtime
      await supabase.channel(`session:${sessionId}`).send({ type: "broadcast", event: "session_stopped", payload: { duration: 0 } });
    }
    return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true }) };
  }

  return { statusCode: 405, headers: cors, body: "Method not allowed" };
};
