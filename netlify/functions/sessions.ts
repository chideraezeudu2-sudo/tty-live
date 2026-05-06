import { Handler } from "@netlify/functions";
import { getUser, supabase, cors } from "./utils";
import crypto from "crypto";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  const user = await getUser(event.headers.authorization);
  if (!user) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Unauthorized" }) };

  // GET - list sessions
  if (event.httpMethod === "GET") {
    const { data } = await supabase.from("sessions").select("*").eq("user_id", user.user_id).order("created_at", { ascending: false });
    return { statusCode: 200, headers: cors, body: JSON.stringify(data ?? []) };
  }

  // POST - start session
  if (event.httpMethod === "POST") {
    const body = JSON.parse(event.body || "{}");
    const sessionId = crypto.randomBytes(4).toString("hex");
    const name = body.name || `Session ${sessionId}`;
    await supabase.from("sessions").insert({ id: sessionId, user_id: user.user_id, name, status: "active", start_time: new Date().toISOString() });
    const viewerUrl = `${process.env.VIEWER_URL}/view/${sessionId}`;
    return { statusCode: 200, headers: cors, body: JSON.stringify({ id: sessionId, name, viewerUrl, status: "active" }) };
  }

  return { statusCode: 405, headers: cors, body: "Method not allowed" };
};
