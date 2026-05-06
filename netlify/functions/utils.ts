import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getUser(authHeader?: string) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const { data } = await supabase.from("auth_tokens").select("*").eq("token", token).single();
  return data;
}

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json"
};

export const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/g,
  /sk-[a-zA-Z0-9]{32,}/g,
  /ghp_[a-zA-Z0-9]{36}/g,
  /xox[baprs]-[a-zA-Z0-9-]+/g,
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----/g,
  /(?:password|passwd|pwd|secret|token|key)\s*=\s*['"]?[^\s'"]{8,}['"]?/gi,
  /(?:DATABASE_URL|MONGODB_URI|REDIS_URL)=\S+/gi,
];

export function shield(data: string): string {
  let s = data;
  for (const p of SECRET_PATTERNS) s = s.replace(p, "[REDACTED]");
  return s;
}
