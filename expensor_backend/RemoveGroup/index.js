const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per eliminare definitivamente un gruppo di spesa.
 * * **Logica di Sicurezza (RBAC):**
 * 1. **Identificazione:** L'utente richiedente viene identificato decodificando il token JWT dal cookie `auth_token`.
 * 2. **Verifica Proprietà:** Interroga il DB per scoprire chi è l'admin del gruppo.
 * 3. **Autorizzazione:** Confronta l'ID estratto dal token con l'admin del gruppo. Se non coincidono, blocca l'operazione (403).
 * 4. **Cascading Delete:** Esegue la cancellazione.
 * * @module GroupManagement
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP.
 * @param {string} req.headers.cookie - Il cookie contenente il token di sessione.
 * @param {object} req.body - Il corpo della richiesta.
 * @param {number} req.body.group_id - L'ID del gruppo da eliminare.
 * * @returns {Promise<void>}
 * - **200 OK**: Gruppo eliminato.
 * - **401 Unauthorized**: Cookie mancante o token invalido.
 * - **403 Forbidden**: L'utente non è l'admin del gruppo.
 * - **404 Not Found**: Il gruppo non esiste.
 * - **500 Internal Server Error**: Errore server.
 */

module.exports = async function (context, req) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = req.headers["origin"];
  const originToUse = requestOrigin === allowedOrigin ? requestOrigin : allowedOrigin;

  const corsHeaders = {
    "Access-Control-Allow-Origin": originToUse,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

    const requestingUserId = decodedToken.oid;
    const { group_id } = req.body;

    if (!group_id) {
      context.res = {
        status: 400,
        body: { error: "Dati mancanti: group_id mancante." },
        headers: corsHeaders,
      };
      return;
    }

    const pool = await connectDB();

    const checkResult = await pool
      .request()
      .input("grp_id", sql.Int, group_id)
      .query(`SELECT admin FROM groups WHERE id = @grp_id`);

    if (checkResult.recordset.length === 0) {
      context.res = { 
          status: 404, 
          body: { error: "Gruppo non trovato." }, 
          headers: corsHeaders 
      };
      return;
    }

    const groupOwner = checkResult.recordset[0].admin;
    
    if (groupOwner !== requestingUserId) {
      context.log.warn(`Tentativo di cancellazione non autorizzato. User: ${requestingUserId}, GroupOwner: ${groupOwner}`);
      context.res = {
        status: 403,
        body: { error: "Non hai i permessi per eliminare questo gruppo. Solo l'admin può farlo." },
        headers: corsHeaders,
      };
      return;
    }

    await pool
      .request()
      .input("id", sql.Int, group_id)
      .query(`DELETE FROM groups WHERE id = @id`);

    context.res = {
      status: 200,
      body: { message: "Gruppo eliminato con successo" },
      headers: corsHeaders,
    };
  } catch (err) {
    context.log.error("Errore RemoveGroup:", err);
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: "Errore interno server: " + err.message },
    };
  }
};