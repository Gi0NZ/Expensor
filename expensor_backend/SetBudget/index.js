const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

module.exports = async function (context, req) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = req.headers["origin"];
  const corsHeaders = {
    "Access-Control-Allow-Origin":
      requestOrigin === allowedOrigin ? requestOrigin : "null",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  try {
    const cookies = parseCookies(req);
    const token = cookies["auth_token"];
    if (!token) throw new Error("No token");
    const decoded = jwt.decode(token);
    const userId = decoded.oid;

    const { monthly_limit } = req.body;

    const pool = await connectDB();

    await pool
      .request()
      .input("userId", sql.NVarChar, userId)
      .input("limit", sql.Decimal(10, 2), monthly_limit).query(`
        MERGE user_budgets AS target
        USING (SELECT @userId AS user_id) AS source
        ON (target.user_id = source.user_id)
        WHEN MATCHED THEN
            UPDATE SET monthly_limit = @limit, last_email_sent_month = NULL
        WHEN NOT MATCHED THEN
            INSERT (user_id, monthly_limit) VALUES (@userId, @limit);
      `);

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: { message: "Budget salvato!" },
    };
  } catch (err) {
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: err.message },
    };
  }
};
