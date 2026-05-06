import { Handler } from "@netlify/functions";
import { getUser, supabase, cors } from "./utils";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  const user = await getUser(event.headers.authorization);
  if (!user) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Unauthorized" }) };

  const { data } = await supabase.from("subscriptions").select("*").eq("user_id", user.user_id).single();
  return { statusCode: 200, headers: cors, body: JSON.stringify(data ?? { plan: "trial", status: "active" }) };
};
