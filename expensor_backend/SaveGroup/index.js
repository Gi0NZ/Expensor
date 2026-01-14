const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per creare un nuovo gruppo di spesa.
 * * **Logica di Funzionamento:**
 * 1. **Sicurezza:** L'utente creatore viene identificato decodificando il token JWT dal cookie `auth_token`.
 * 2. **SQL Output:** La query utilizza `OUTPUT Inserted.id` per restituire l'ID del nuovo gruppo.
 * 3. **Input:** Richiede il `name` del gruppo nel body.
 * * @module GroupManagement
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP.
 * @param {string} req.headers.cookie - Il cookie contenente il token di sessione.
 * @param {object} req.body - Il corpo della richiesta.
 * @param {string} req.body.name - Il nome del nuovo gruppo.
 * * @returns {Promise<void>}
 * - **200 OK**: Restituisce l'oggetto del gruppo creato.
 * - **204 No Content**: Preflight CORS.
 * - **400 Bad Request**: Parametro `name` mancante.
 * - **401 Unauthorized**: Cookie mancante o token invalido.
 * - **500 Internal Server Error**: Errore server.
 */
module.exports = async function (context, req) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = req.headers["origin"];
  const originToUse = requestOrigin === allowedOrigin ? requestOrigin : allowedOrigin;

  const corsHeaders = {
    "Access-Control-Allow-Origin": originToUse,
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

    const microsoft_id = decodedToken.oid;
    const { name } = req.body;

    if (!name) {
      context.res = {
        status: 400,
        headers: corsHeaders,
        body: { error: "Nome del gruppo mancante." },
      };
      return;
    }

    const pool = await connectDB();

    const result = await pool
      .request()
      .input("name", sql.NVarChar(255), name)
      .input("admin", sql.NVarChar(255), microsoft_id)
      .query(`
          INSERT INTO groups (name, created_by, created_at, admin)
          OUTPUT INSERTED.* VALUES (@name, @admin, GETDATE(), @admin);
      `);

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: result.recordset[0],
    };
  } catch (err) {
    context.log.error("Error 500 su SaveGroup", err);
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: `Errore: ${err.message}` },
    };
  }
};