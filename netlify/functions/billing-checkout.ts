import { Handler } from "@netlify/functions";
import { getUser, cors } from "./utils";
import Stripe from "stripe";

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };
  const user = await getUser(event.headers.authorization);
  if (!user) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Unauthorized" }) };

  const { plan } = JSON.parse(event.body || "{}");
  const priceId = plan === "pro" ? process.env.STRIPE_PRO_PRICE_ID : process.env.STRIPE_BASIC_PRICE_ID;
  if (!priceId) return { statusCode: 400, headers: cors, body: "Invalid plan" };

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription", payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/?billing=success`,
      cancel_url: `${process.env.FRONTEND_URL}/?billing=cancelled`,
      metadata: { userId: user.user_id },
    });
    return { statusCode: 200, headers: cors, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Stripe failed" }) };
  }
};
