import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const { data: authData } = await supabase.from("auth_tokens").select("user_id").eq("token", token).single();
  if (!authData) return res.status(401).json({ error: "Unauthorized" });

  const { data: sub } = await supabase.from("subscriptions").select("stripe_customer_id").eq("user_id", authData.user_id).single();
  if (!sub?.stripe_customer_id) return res.status(400).json({ error: "No billing account" });

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.billingPortal.sessions.create({ customer: sub.stripe_customer_id, return_url: process.env.FRONTEND_URL });
    res.json({ url: session.url });
  } catch {
    res.status(500).json({ error: "Portal failed" });
  }
}
