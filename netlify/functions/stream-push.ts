import { Handler } from "@netlify/functions";
import { supabase, cors, shield } from "./utils";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

  const { session_id, data } = JSON.parse(event.body || "{}");
  if (!session_id || !data) return { statusCode: 400, headers: cors, body: "Missing fields" };

  const sanitized = shield(data);
  await supabase.from("session_buffer").insert({ session_id, chunk: sanitized });
  await supabase.channel(`session:${session_id}`).send({ type: "broadcast", event: "terminal_data", payload: { data: sanitized } });

  return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
};
