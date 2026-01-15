const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

module.exports = async function (context, req) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = req.headers["origin"];
  const corsHeaders = {
    "Access-Control-Allow-Origin": requestOrigin === allowedOrigin ? requestOrigin : "null",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  try {
    const cookies = parseCookies(req);
    const token = cookies["auth_token"];
    if (!token) throw new Error("No token");
    const userId = jwt.decode(token).oid;

    const pool = await connectDB();
    
    // Recupera limite e somma spese mese corrente
    const result = await pool.request()
      .input("userId", sql.NVarChar, userId)
      .query(`
        SELECT 
            b.monthly_limit,
            (SELECT ISNULL(SUM(amount), 0) 
             FROM expenses 
             WHERE user_id = @userId 
             AND MONTH(date) = MONTH(GETDATE()) 
             AND YEAR(date) = YEAR(GETDATE())
            ) AS current_spent
        FROM user_budgets b
        WHERE b.user_id = @userId
      `);

    context.res = { 
        status: 200, 
        headers: corsHeaders, 
        body: result.recordset.length > 0 ? result.recordset[0] : null 
    };
  } catch (err) {
    context.res = { status: 500, headers: corsHeaders, body: { error: err.message } };
  }
};