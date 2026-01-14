const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per rimuovere un membro da un gruppo.
 * * **Logica di Sicurezza (Query Atomica):**
 * 1. **Verifica Permessi:** Utilizza una subquery `EXISTS` per garantire che chi fa la richiesta (identificato dal Cookie) sia l'**Admin** del gruppo.
 * 2. **Output Delete:** Utilizza la clausola `OUTPUT` per restituire l'ID dell'utente cancellato solo se l'operazione ha successo.
 * 3. **Risultato:** Se l'utente richiedente non è admin, la condizione WHERE fallisce e non viene restituito alcun ID (permettendo di lanciare un errore 403).
 * * @module GroupMembers
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP.
 * @param {string} req.headers.cookie - Il cookie contenente il token di sessione.
 * @param {object} req.body - Il corpo della richiesta.
 * @param {number} req.body.groupId - L'ID del gruppo da cui rimuovere il membro.
 * @param {string} req.body.removedId - L'ID Microsoft dell'utente da espellere.
 * * @returns {Promise<void>}
 * - **200 OK**: Membro rimosso correttamente.
 * - **400 Bad Request**: Dati mancanti.
 * - **401 Unauthorized**: Cookie mancante o token invalido.
 * - **403 Forbidden**: Utente non autorizzato (non è admin) o membro non trovato.
 * - **500 Internal Server Error**: Errore server.
 */

module.exports = async function (context, req) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = req.headers["origin"];
  const corsHeaders = {
    "Access-Control-Allow-Origin":
      requestOrigin === allowedOrigin ? requestOrigin : "null",
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

    const reqId = decodedToken.oid;
    const { groupId, removedId } = req.body;

    if (!groupId || !removedId) {
      context.res = {
        status: 400,
        headers: corsHeaders,
        body: {
          error: "Campi obbligatori mancanti (groupId, removedId).",
        },
      };
      return;
    }

    const pool = await connectDB();

    const result = await pool
      .request()
      .input("groupId", sql.Int, groupId)
      .input("removed_id", sql.NVarChar, removedId)
      .input("reqId", sql.NVarChar(255), reqId).query(`
        DELETE FROM group_members
        OUTPUT Deleted.user_id
        WHERE group_id = @groupId 
        AND user_id = @removed_id
        AND EXISTS(
            SELECT 1 
            FROM groups
            WHERE id = @groupId AND admin = @reqId
        )
    `);

    if (result.recordset.length === 0) {
        context.res = {
            status: 403,
            headers: corsHeaders,
            body: { error: "Operazione fallita: Non sei Admin o l'utente non esiste nel gruppo." }
        };
        return;
    }

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: { message: "Membro gruppo eliminato con successo!" },
    };
  } catch (err) {
    context.log.error("Errore RemoveGroupMember:", err);

    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: `Errore SQL: ${err.message}` },
    };
  }
};