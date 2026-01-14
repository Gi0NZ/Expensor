const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per eliminare una spesa di gruppo.
 * * **Logica di Sicurezza (Query Atomica):**
 * Utilizza una clausola `WHERE EXISTS` per verificare che l'utente richiedente (identificato tramite Cookie) sia l'Admin del gruppo nello stesso momento in cui tenta di eliminare la spesa.
 * Se l'utente non è admin, la condizione `EXISTS` fallisce e nessuna riga viene eliminata.
 * * @module GroupExpenses
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP.
 * @param {string} req.headers.cookie - Il cookie contenente il token di sessione.
 * @param {object} req.body - Parametri per l'eliminazione.
 * @param {number} req.body.groupId - ID del gruppo.
 * @param {number} req.body.expenseId - ID della spesa da eliminare.
 * * @returns {Promise<void>}
 * - **200 OK**: Spesa eliminata.
 * - **400 Bad Request**: Dati mancanti.
 * - **401 Unauthorized**: Cookie mancante o token invalido.
 * - **403 Forbidden**: Spesa non trovata o utente non autorizzato (non è admin).
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

    const requestingUserId = decodedToken.oid;
    const { groupId, expenseId } = req.body;

    if (!groupId || !expenseId) {
      context.res = {
        status: 400,
        headers: corsHeaders,
        body: { error: "Campi obbligatori mancanti (groupId o expenseId)." },
      };
      return;
    }

    const pool = await connectDB();

    const result = await pool
      .request()
      .input("groupId", sql.Int, groupId)
      .input("id", sql.Int, expenseId)
      .input("reqId", sql.NVarChar(255), requestingUserId).query(`
        DELETE FROM group_expenses
        OUTPUT Deleted.id
        WHERE group_id = @groupId 
        AND id = @id
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
        body: {
          error:
            "Operazione fallita: Spesa non trovata oppure non hai i permessi di Admin.",
        },
      };
      return;
    }

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: { message: "Spesa gruppo eliminata con successo!" },
    };
  } catch (err) {
    context.log.error("Errore RemoveExpenses:", err);

    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: `Errore interno: ${err.message}` },
    };
  }
};