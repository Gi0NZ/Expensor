const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per ottenere il riepilogo delle spese totali raggruppate per categoria.
 * * **Funzionamento:**
 * 1. **Gestione CORS:** Gestione del preflight "OPTIONS" con supporto credenziali.
 * 2. **Sicurezza:** Identifica l'utente decodificando il token JWT dal cookie `auth_token`.
 * 3. **Aggregazione:** Esegue una query SQL con `GROUP BY` e `SUM` filtrando per l'ID utente estratto dal token.
 *
 * * @module Expenses
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP.
 * @param {string} req.headers.cookie - Il cookie contenente il token di sessione.
 * * @returns {Promise<void>}
 * - **200 OK**: Restituisce un array di oggetti `{ category_name, total }`.
 * - **204 No Content**: Preflight CORS.
 * - **401 Unauthorized**: Cookie mancante o token invalido.
 * - **500 Internal Server Error**: Errore durante l'esecuzione della query.
 */

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
    context.res = {
      status: 204,
      headers: corsHeaders,
    };
    return;
  }

  try {
    const cookies = parseCookies(req);
    const token = cookies["auth_token"];

    if (!token) {
      context.log.warn("GetExpensesByCategory: Cookie mancante");
      context.res = {
        status: 401,
        headers: corsHeaders,
        body: { error: "Non autenticato." },
      };
      return;
    }

    const decodedToken = jwt.decode(token);
    if (!decodedToken || !decodedToken.oid) {
      context.res = {
        status: 401,
        headers: corsHeaders,
        body: { error: "Token non valido." },
      };
      return;
    }

    const microsoft_id = decodedToken.oid;

    const pool = await connectDB();

    const result = await pool
      .request()
      .input("microsoft_id", sql.NVarChar, microsoft_id).query(`
      SELECT 
          c.name AS category_name,
          SUM(e.amount) AS total
      FROM expenses e
      INNER JOIN categories c ON e.category_id = c.id
      WHERE e.user_id = @microsoft_id
      GROUP BY c.name
    `);

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: result.recordset,
    };
  } catch (err) {
    context.log.error("Errore GetExpensesByCategory:", err);
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: `Errore SQL: ${err.message}` },
    };
  }
};
