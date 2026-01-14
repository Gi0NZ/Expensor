const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per recuperare i dettagli di una specifica spesa di gruppo.
 * * **Funzionamento:**
 * 1. **Gestione CORS:** Verifica origine e preflight CORS con credenziali.
 * 2. **Sicurezza:** Verifica che la richiesta provenga da un utente autenticato tramite cookie.
 * 3. **Join Dati:** Esegue una query SQL con `JOIN` sulla tabella `users` per ottenere il nome leggibile di chi ha pagato.
 * * @module GroupExpenses
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP.
 * @param {string} req.headers.cookie - Il cookie contenente il token di sessione.
 * @param {string} req.query.groupId - L'ID del gruppo.
 * @param {string} req.query.expenseId - L'ID univoco della spesa da recuperare.
 * * @returns {Promise<void>}
 * - **200 OK**: Restituisce l'oggetto spesa completo.
 * - **204 No Content**: Preflight CORS.
 * - **400 Bad Request**: Parametri mancanti.
 * - **401 Unauthorized**: Cookie mancante o token invalido.
 * - **500 Internal Server Error**: Errore di connessione o query.
 */
module.exports = async function (context, req) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = req.headers["origin"];

  const corsHeaders = {
    "Access-Control-Allow-Origin":
      requestOrigin === allowedOrigin ? requestOrigin : "null",
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
    const groupId = req.query.groupId;
    const expenseId = req.query.expenseId;

    if (!groupId || !expenseId) {
      context.res = {
        status: 400,
        headers: corsHeaders,
        body: { error: "Parametri groupId o expenseId mancanti." },
      };
      return;
    }

    const result = await pool
      .request()
      .input("group_id", sql.Int, groupId)
      .input("expense_id", sql.Int, expenseId).query(`
            SELECT ge.*, u.name as paid_by_name 
            FROM group_expenses ge
            JOIN users u ON ge.paid_by = u.microsoft_id
            WHERE ge.id = @expense_id
            AND ge.group_id = @group_id
        `);

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: result.recordset[0],
    };
  } catch (err) {
    context.log.error("Errore GetExpenseDetails:", err);

    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: `Errore nel recupero delle spese: ${err.message}` },
    };
  }
};
