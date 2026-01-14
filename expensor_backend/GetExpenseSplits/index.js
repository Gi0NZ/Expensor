const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per recuperare i dettagli delle quote (splits) di una specifica spesa di gruppo.
 * * **Funzionamento:**
 * 1. **CORS:** Gestisce le richieste cross-origin e il preflight con credenziali.
 * 2. **Sicurezza:** Verifica che la richiesta provenga da un utente autenticato tramite cookie.
 * 3. **Join Dati:** Recupera le quote dalla tabella `group_expense_shares` facendo una JOIN con `users`.
 * 4. **Input Flessibile:** Accetta l'ID della spesa sia da `query string` che da `body`.
 * * @module GroupExpenses
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP.
 * @param {string} req.headers.cookie - Il cookie contenente il token di sessione.
 * @param {number} req.query.expenseId - L'ID della spesa di cui recuperare le quote.
 * * @returns {Promise<void>}
 * - **200 OK**: Restituisce un array con la lista degli utenti coinvolti e le relative quote.
 * - **204 No Content**: Preflight CORS.
 * - **400 Bad Request**: Parametro `expenseId` mancante.
 * - **401 Unauthorized**: Cookie mancante o token invalido.
 * - **500 Internal Server Error**: Errore del server o del database.
 */

module.exports = async function (context, req) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = req.headers["origin"];
  const corsHeaders = {
    "Access-Control-Allow-Origin":
      requestOrigin === allowedOrigin ? requestOrigin : "null",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

    const pool = await connectDB();
    const expense_id = req.query.expenseId || req.body.expenseId;

    if (!expense_id) {
      context.log.warn(`GetExpenseSplit: ID spesa mancante`);
      context.res = {
        status: 400,
        body: { error: "ID spesa mancante" },
        headers: corsHeaders,
      };
      return;
    }

    const result = await pool.request().input("expId", sql.Int, expense_id)
      .query(`
            SELECT 
                ges.user_id, 
                ges.share_amount as amount, 
                ges.last_updated,
                u.name as user_name,
                u.email as user_email
            FROM group_expense_shares ges
            JOIN users u ON ges.user_id = u.microsoft_id
            WHERE ges.expense_id = @expId
        `);

    context.res = {
      status: 200,
      body: result.recordset,
      headers: corsHeaders,
    };
  } catch (err) {
    context.log.error("GetExpenseSplit: errore 500 Interno", err);
    context.res = {
      status: 500,
      body: { error: `Errore nel recupero degli split ${err.message}` },
      headers: corsHeaders,
    };
  }
};
