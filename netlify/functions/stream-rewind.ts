import { Handler } from "@netlify/functions";
import { supabase, cors } from "./utils";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  const session_id = event.queryStringParameters?.session_id;
  if (!session_id) return { statusCode: 400, headers: cors, body: "Missing session_id" };

  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data } = await supabase.from("session_buffer").select("chunk,created_at").eq("session_id", session_id).gte("created_at", since).order("created_at");
  return { statusCode: 200, headers: cors, body: JSON.stringify(data ?? []) };
};
