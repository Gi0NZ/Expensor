const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per cercare un utente nel database tramite il suo indirizzo email.
 * * **Utilizzo:**
 * Questa funzione è spesso utilizzata quando si vuole aggiungere un membro a un gruppo conoscendo solo la sua mail.
 * * **Funzionalità:**
 * 1. **Gestione CORS:** Permette chiamate sicure con credenziali (Cookie).
 * 2. **Sicurezza:** Verifica che la richiesta provenga da un utente autenticato.
 * 3. **Ricerca:** Esegue una `SELECT` filtrata per email.
 * * @module User
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP.
 * @param {string} req.headers.cookie - Il cookie contenente il token di sessione.
 * @param {string} req.query.email - L'indirizzo email dell'utente da cercare.
 * * @returns {Promise<void>}
 * - **200 OK**: Restituisce un array contenente l'utente trovato.
 * - **204 No Content**: Preflight CORS.
 * - **400 Bad Request**: Parametro `email` mancante.
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

    const email = req.query.email;

    if (!email) {
      context.res = {
        status: 400,
        body: { error: "Parametro mail mancante" },
        headers: corsHeaders,
      };
      return;
    }

    const pool = await connectDB();
    const result = await pool.request().input("email", sql.NVarChar, email)
      .query(`
      SELECT microsoft_id, id, email, name, created_at
        FROM users u
        WHERE u.email = @email
    `);

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: result.recordset,
    };
  } catch (err) {
    context.log.error("GetUserByMail: errore 500 interno", err);
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: `Errore nel recupero dell'utente: ${err.message}` },
    };
  }
};