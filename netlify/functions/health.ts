import { Handler } from "@netlify/functions";
export const handler: Handler = async () => ({
  statusCode: 200,
  body: JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }),
  headers: { "Content-Type": "application/json" }
});
