const { parseCookies } = require("../utils/cookieHelper");

module.exports = async function (context, req) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = req.headers["origin"];
  
  const corsHeaders = {
    "Access-Control-Allow-Origin": requestOrigin === allowedOrigin ? requestOrigin : "null",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  const isProduction = process.env.NODE_ENV === "production";

  context.res = {
    status: 200,
    headers: corsHeaders,
    body: { message: "Logout effettuato" },
    cookies: [
      {
        name: "auth_token",
        value: "",
        path: "/",
        expires: new Date(0),  
        httpOnly: true,
        secure: isProduction,
        sameSite: "Lax"
      }
    ]
  };
};