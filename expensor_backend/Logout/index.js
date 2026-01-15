module.exports = async function (context, req) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = req.headers["origin"];
  const originToUse = requestOrigin === allowedOrigin ? requestOrigin : allowedOrigin;

  const corsHeaders = {
    "Access-Control-Allow-Origin": originToUse,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  const cookieString = "auth_token=; Path=/; HttpOnly; Secure; SameSite=None; Expires=Thu, 01 Jan 1970 00:00:00 GMT";

  context.res = {
    status: 200,
    headers: {
      ...corsHeaders,
      "Set-Cookie": cookieString 
    },
    body: { message: "Logout locale effettuato con successo" }
  };
};