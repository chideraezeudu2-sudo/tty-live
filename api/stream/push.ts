import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/g, /sk-[a-zA-Z0-9]{32,}/g, /ghp_[a-zA-Z0-9]{36}/g,
  /xox[baprs]-[a-zA-Z0-9-]+/g, /-----BEGIN (RSA |EC )?PRIVATE KEY-----/g,
  /(?:password|passwd|pwd|secret|token|key)\s*=\s*['"]?[^\s'"]{8,}['"]?/gi,
  /(?:DATABASE_URL|MONGODB_URI|REDIS_URL)=\S+/gi,
];

function shield(data: string): string {
  let s = data;
  for (const p of SECRET_PATTERNS) s = s.replace(p, "[REDACTED]");
  return s;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { session_id, data } = req.body;
  if (!session_id || !data) return res.status(400).json({ error: "Missing session_id or data" });

  const sanitized = shield(data);

  // Store chunk for rewind (keep last 5 min — old ones cleaned by DB function)
  await supabase.from("session_buffer").insert({ session_id, chunk: sanitized });

  // Broadcast to viewers via Supabase Realtime
  const channel = supabase.channel(`session:${session_id}`);
  await channel.send({ type: "broadcast", event: "terminal_data", payload: { data: sanitized } });

  res.json({ ok: true });
}
