const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per recuperare tutti i gruppi associati a un utente specifico.
 * * **Logica SQL:**
 * Utilizza una query con `DISTINCT` e `LEFT JOIN` per trovare i gruppi in cui l'utente ricopre almeno un ruolo tra:
 * 1. **Creatore** (`created_by`).
 * 2. **Amministratore** (`admin`).
 * 3. **Membro partecipante** (`group_members`).
 * * **Sicurezza:**
 * L'identità dell'utente viene recuperata decodificando il token JWT dal cookie `auth_token`.
 * * @module GroupManagement
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP.
 * @param {string} req.headers.cookie - Il cookie contenente il token di sessione.
 * * @returns {Promise<void>}
 * - **200 OK**: Restituisce un array di oggetti gruppo.
 * - **204 No Content**: Preflight CORS.
 * - **401 Unauthorized**: Cookie mancante o token invalido.
 * - **500 Internal Server Error**: Errore server o database.
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

    const user_id = decodedToken.oid;

    const pool = await connectDB();

    const result = await pool
      .request()
      .input("current_user", sql.NVarChar, user_id).query(`
      SELECT DISTINCT 
          g.id, 
          g.name, 
          g.admin, 
          g.created_by, 
          g.created_at
      FROM groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      WHERE 
         g.created_by = @current_user
         OR 
         g.admin = @current_user
         OR 
         gm.user_id = @current_user
    `);

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: result.recordset,
    };
  } catch (err) {
    context.log.error("GetGroups: errore 500 interno", err);
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: `Errore nel recupero dei gruppi: ${err.message}` },
    };
  }
};
