import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { buffer } from "micro";

export const config = { api: { bodyParser: false } };

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const sig = req.headers["stripe-signature"] as string;
  const rawBody = await buffer(req);

  try {
    const event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);

    if (event.type === "checkout.session.completed") {
      const s: any = event.data.object;
      if (s.metadata?.userId) {
        await supabase.from("subscriptions").upsert({
          id: s.subscription, user_id: s.metadata.userId,
          stripe_customer_id: s.customer, stripe_subscription_id: s.subscription,
          plan: "basic", status: "active"
        });
      }
    }
    if (event.type === "customer.subscription.deleted") {
      const s: any = event.data.object;
      await supabase.from("subscriptions").update({ status: "cancelled", plan: "trial" }).eq("stripe_subscription_id", s.id);
    }
    if (event.type === "customer.subscription.updated") {
      const s: any = event.data.object;
      await supabase.from("subscriptions").update({ status: s.status, current_period_end: new Date(s.current_period_end * 1000).toISOString() }).eq("stripe_subscription_id", s.id);
    }

    res.json({ received: true });
  } catch (err) {
    res.status(400).send("Webhook error");
  }
}
