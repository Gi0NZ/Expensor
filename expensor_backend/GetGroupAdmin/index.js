const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per recuperare le informazioni dell'amministratore di un gruppo.
 * * **Funzionamento:**
 * 1. **Gestione CORS:** Gestione della preflight con supporto credenziali (Cookie).
 * 2. **Sicurezza:** Verifica che la richiesta provenga da un utente autenticato tramite cookie `auth_token`.
 * 3. **Recupero Admin:** Esegue una JOIN tra `groups` e `users` per ottenere ID e nome dell'admin.
 * * @module GroupManagement
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP.
 * @param {string} req.headers.cookie - Il cookie contenente il token di sessione.
 * @param {number} req.query.group_id - L'ID del gruppo da analizzare.
 * * @returns {Promise<void>}
 * - **200 OK**: Restituisce un array contenente `{ admin, id, name }`.
 * - **204 No Content**: Preflight CORS.
 * - **400 Bad Request**: Parametro `group_id` mancante.
 * - **401 Unauthorized**: Cookie mancante o token invalido.
 * - **500 Internal Server Error**: Errore server o database.
 */

module.exports = async function (context, req) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = req.headers["origin"];
  const originToUse = requestOrigin === allowedOrigin ? requestOrigin : allowedOrigin;

  const corsHeaders = {
    "Access-Control-Allow-Origin": originToUse,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") {
    context.res = {
      status: 204,
      headers: corsHeaders
    };
    return;
  }

  try {
    const cookies = parseCookies(req);
    const token = cookies['auth_token'];

    if (!token) {
      context.res = {
        status: 401,
        headers: corsHeaders,
        body: { error: "Non autenticato." }
      };
      return;
    }

    const decodedToken = jwt.decode(token);
    if (!decodedToken || !decodedToken.oid) {
      context.res = {
        status: 401,
        headers: corsHeaders,
        body: { error: "Token non valido." }
      };
      return;
    }

    const group_id = req.query.group_id;

    if (!group_id) {
      context.res = {
        status: 400,
        body: { error: "Parametro group_id mancante" },
        headers: corsHeaders,
      };
      return;
    }

    const pool = await connectDB();

    const result = await pool.request()
      .input("group_id", sql.Int, group_id)
      .query(`
        SELECT 
          g.admin,
          g.id,
          u.name
        FROM groups g
        JOIN users u ON g.admin = u.microsoft_id
        WHERE g.id = @group_id
    `);

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: result.recordset,
    };
  } catch (err) {
    context.log.error("GetGroupAdmin: errore 500 interno", err);
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: `Errore nel recupero dell'admin del gruppo: ${err.message}` },
    };
  }
};