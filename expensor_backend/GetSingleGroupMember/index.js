const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per recuperare i dettagli di un singolo membro all'interno di un gruppo specifico.
 * * **Funzionalità:**
 * 1. **Ricerca Specifica:** Cerca una corrispondenza esatta nella tabella `group_members`.
 * 2. **Gestione Assenza:** Se l'utente non fa parte del gruppo, restituisce un array vuoto (status 200) invece di un errore, facilitando i controlli condizionali.
 * 3. **Sicurezza:** Verifica che la richiesta provenga da un utente autenticato tramite cookie.
 * * @module GroupMembers
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP.
 * @param {string} req.headers.cookie - Il cookie contenente il token di sessione.
 * @param {number} req.query.group_id - L'ID del gruppo da interrogare.
 * @param {string} req.query.microsoft_id - L'ID dell'utente da cercare nel gruppo.
 * * @returns {Promise<void>}
 * - **200 OK**: Restituisce un array contenente l'oggetto membro (se trovato) o un array vuoto (se non trovato).
 * - **204 No Content**: Preflight CORS.
 * - **400 Bad Request**: Parametri mancanti.
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
    const microsoft_id = req.query.microsoft_id;

    if (!microsoft_id || !group_id) {
      context.res = {
        status: 400,
        headers: corsHeaders,
        body: { error: "Parametro microsoft_id o group_id mancante." },
      };
      return;
    }

    const pool = await connectDB();

    const result = await pool
      .request()
      .input("group_id", sql.Int, group_id)
      .input("microsoft_id", sql.NVarChar(255), microsoft_id).query(`
      SELECT group_id, user_id, contributed_amount, owed_amount, settled_amount
      FROM group_members gm
      WHERE gm.group_id = @group_id AND gm.user_id = @microsoft_id
    `);

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: result.recordset,
    };
  } catch (err) {
    context.log.error("GetSingleGroupMember: errore 500 interno", err);
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: `Errore nel recupero del singolo utente: ${err.message}` },
    };
  }
};