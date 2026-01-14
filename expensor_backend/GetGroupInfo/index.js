const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per recuperare le informazioni generali di un gruppo (es. nome, data creazione, admin).
 * * **Funzionalità:**
 * 1. **Gestione CORS:** Gestisce il preflight "OPTIONS" con credenziali.
 * 2. **Sicurezza:** Verifica che la richiesta provenga da un utente autenticato tramite cookie.
 * 3. **Recupero Dati:** Esegue una `SELECT *` sulla tabella `groups` filtrando per ID.
 * * @module GroupManagement
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP.
 * @param {string} req.headers.cookie - Il cookie contenente il token di sessione.
 * @param {number} req.query.group_id - L'ID del gruppo da recuperare.
 * * @returns {Promise<void>}
 * - **200 OK**: Restituisce un array contenente l'oggetto gruppo.
 * - **204 No Content**: Preflight CORS.
 * - **400 Bad Request**: Parametro `group_id` mancante.
 * - **401 Unauthorized**: Cookie mancante o token invalido.
 * - **500 Internal Server Error**: Errore server o database.
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
      context.log.warn("GetGroupInfo: parametro group_id mancante");
      context.res = {
        status: 400,
        body: { error: "Parametro group_id mancante" },
        headers: corsHeaders,
      };
      return;
    }

    const pool = await connectDB();

    const result = await pool.request().input("group_id", sql.Int, group_id)
      .query(`
        SELECT *
        FROM groups g
        WHERE g.id = @group_id
    `);

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: result.recordset,
    };
  } catch (err) {
    context.log.error("GetGroupInfo: errore 500 interno", err);
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: {
        error: {
          error: `Errore nel recupero delle informazioni del gruppo: ${err.message}`,
        },
      },
    };
  }
};