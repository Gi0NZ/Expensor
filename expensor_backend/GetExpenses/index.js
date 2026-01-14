const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

module.exports = async function (context, req) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = req.headers["origin"];
  const originToUse =
    requestOrigin === allowedOrigin ? requestOrigin : allowedOrigin;

  const corsHeaders = {
    "Access-Control-Allow-Origin": originToUse,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  try {
    const cookies = parseCookies(req);
    const token = cookies["auth_token"];

    if (!token) {
      context.res = {
        status: 401,
        headers: corsHeaders,
        body: { error: "Non autenticato" },
      };
      return;
    }

    const decoded = jwt.decode(token);

    const user_id = decoded.oid;

    const pool = await connectDB();

    const result = await pool.request().input("user_id", sql.NVarChar, user_id)
      .query(`
        SELECT e.id,
             e.user_id, 
             e.description, 
             e.amount, 
             e.date, 
             c.name as category_name, 
             c.id as cat_id
        FROM expenses e
        INNER JOIN categories c ON e.category_id = c.id
        WHERE e.user_id = @user_id
        ORDER BY e.date DESC
      `);

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: result.recordset,
    };
  } catch (err) {
    context.log.error("GetExpenses: Errore", err);
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: err.message },
    };
  }
};
