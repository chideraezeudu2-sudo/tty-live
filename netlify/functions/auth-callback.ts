import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export const handler: Handler = async (event) => {
  const code = event.queryStringParameters?.code;
  if (!code) return { statusCode: 400, body: "Missing code" };

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code }),
    });
    const tokenData: any = await tokenRes.json();

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const ghUser: any = await userRes.json();
    const userId = `gh_${ghUser.id}`;

    await supabase.from("users").upsert({ id: userId, github_id: String(ghUser.id), username: ghUser.login, avatar_url: ghUser.avatar_url });

    const { data: existingSub } = await supabase.from("subscriptions").select("id").eq("user_id", userId).single();
    if (!existingSub) {
      const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 7);
      await supabase.from("subscriptions").insert({ id: `sub_${userId}`, user_id: userId, plan: "trial", status: "active", trial_ends_at: trialEnd.toISOString() });
    }

    const token = crypto.randomBytes(32).toString("hex");
    await supabase.from("auth_tokens").upsert({ token, user_id: userId, username: ghUser.login, avatar_url: ghUser.avatar_url });

    const frontendUrl = process.env.FRONTEND_URL || "https://ttylive.netlify.app";
    return {
      statusCode: 302,
      headers: { Location: `${frontendUrl}/?token=${token}&username=${ghUser.login}&avatar=${encodeURIComponent(ghUser.avatar_url)}` },
      body: ""
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: "Auth failed" };
  }
};
