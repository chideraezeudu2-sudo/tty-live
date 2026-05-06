import { Handler } from "@netlify/functions";
import { getUser, supabase, cors } from "./utils";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  const user = await getUser(event.headers.authorization);
  if (!user) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Unauthorized" }) };

  const { data: sessions } = await supabase.from("sessions").select("start_time,end_time,peak_viewers").eq("user_id", user.user_id);
  return {
    statusCode: 200, headers: cors,
    body: JSON.stringify({
      totalSessions: sessions?.length ?? 0,
      totalMinutes: sessions?.reduce((a: number, s: any) => s.end_time ? a + Math.floor((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000) : a, 0) ?? 0,
      totalViewers: sessions?.reduce((a: number, s: any) => a + (s.peak_viewers ?? 0), 0) ?? 0,
    })
  };
};
