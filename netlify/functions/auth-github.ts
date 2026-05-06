import { Handler } from "@netlify/functions";
export const handler: Handler = async () => ({
  statusCode: 302,
  headers: {
    Location: `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${process.env.SERVER_URL}/api/auth-callback&scope=read:user`
  },
  body: ""
});
