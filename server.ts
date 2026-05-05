// server.ts — Vercel serverless API routes
// WebSocket replaced with Supabase Realtime channels
// All state stored in Supabase DB

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/g,
  /sk-[a-zA-Z0-9]{32,}/g,
  /ghp_[a-zA-Z0-9]{36}/g,
  /xox[baprs]-[a-zA-Z0-9-]+/g,
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----/g,
  /(?:password|passwd|pwd|secret|token|key)\s*=\s*['"]?[^\s'"]{8,}['"]?/gi,
  /(?:DATABASE_URL|MONGODB_URI|REDIS_URL)=\S+/gi,
];

export function applyPrivacyShield(data: string, customPatterns: string[] = []): string {
  let s = data;
  for (const p of SECRET_PATTERNS) s = s.replace(p, "[REDACTED]");
  for (const p of customPatterns) { try { s = s.replace(new RegExp(p, "g"), "[REDACTED]"); } catch {} }
  return s;
}

export function generateId() { return crypto.randomBytes(4).toString("hex"); }
export function generateToken() { return crypto.randomBytes(32).toString("hex"); }
export { supabase };
