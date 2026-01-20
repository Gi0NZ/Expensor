const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");
const { Resend } = require("resend");
const { expelledNotify } = require("../utils/expelledNotify");

/**
 * Azure Function per rimuovere (espellere) un membro da un gruppo esistente.
 *
 * **Sicurezza e Logica SQL (Atomic Check):**
 * La funzione esegue una `DELETE` condizionata per garantire che solo l'amministratore possa rimuovere membri:
 * 1. **Verifica Permessi:** La clausola `WHERE EXISTS` controlla che l'utente richiedente (`@reqId`) sia l'Admin del gruppo.
 * 2. **Verifica Esito:** Utilizza `OUTPUT Deleted.user_id` per restituire l'ID del record eliminato.
 * 3. **Gestione Errori:** Se la query non restituisce righe, significa che il membro non esisteva **oppure** che il richiedente non era autorizzato. In entrambi i casi, viene restituito un errore 403 per sicurezza.
 *
 * @module GroupMembers
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 * @param {Object} req.body - Il payload della richiesta.
 * @param {number} req.body.groupId - L'ID del gruppo da cui rimuovere il membro.
 * @param {string} req.body.removedId - L'ID Microsoft (UUID) dell'utente da espellere.
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Membro rimosso con successo.
 * - **400 Bad Request**: Parametri `groupId` o `removedId` mancanti.
 * - **401 Unauthorized**: Cookie mancante o token non valido.
 * - **403 Forbidden**: Operazione fallita (Utente non admin o membro non trovato nel gruppo).
 * - **500 Internal Server Error**: Errore server o database.
 */
module.exports = async function (context, req) {
  try {
    const cookies = parseCookies(req);
    const token = cookies["auth_token"];

    if (!token) {
      context.res = {
        status: 401,

        body: { error: "Non autenticato." },
      };
      return;
    }

    const decodedToken = jwt.decode(token);
    if (!decodedToken || !decodedToken.oid) {
      context.res = {
        status: 401,

        body: { error: "Token non valido." },
      };
      return;
    }

    const reqId = decodedToken.oid;
    const { groupId, removedId } = req.body;

    if (!groupId || !removedId) {
      context.res = {
        status: 400,

        body: {
          error: "Campi obbligatori mancanti (groupId, removedId).",
        },
      };
      return;
    }

    const pool = await connectDB();

    const infoResultPre = await pool
      .request()
      .input("gid", sql.Int, groupId)
      .input("uid", sql.NVarChar, removedId).query(`
               SELECT u.email, u.name as user_name, g.name as group_name
               FROM users u, groups g
               WHERE u.microsoft_id = @uid AND g.id = @gid
           `);

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

        body: {
          error:
            "Operazione fallita: Non sei Admin o l'utente non esiste nel gruppo.",
        },
      };
      return;
    }

    const requesterName = await pool
      .request()
      .input("requester_id", sql.NVarChar, reqId).query(`
      SELECT u.email, u.name
      FROM users u
      WHERE u.microsoft_id = @requester_id
      `);

    console.log("REQUESTER NAME:", requesterName.recordset[0].name);

    const infoResultPost = await pool
      .request()
      .input("group_id", sql.Int, groupId)
      .input("removed_id", sql.NVarChar, removedId).query(`
      SELECT *
          FROM group_members g
          WHERE g.group_id = @group_id AND g.user_id = @removed_id
      `);

    if (infoResultPost.recordset.length === 0) {
      const { email, user_name, group_name } = infoResultPre.recordset[0];
      const sender_email = process.env.SENDER_EMAIL;
      const admin_mail = requesterName.recordset[0].email;
      const admin_name = requesterName.recordset[0].name;
      try {
        await expelledNotify(
          email,
          user_name,
          sender_email,
          admin_mail,
          admin_name,
          group_name,
        );
      } catch (emailErr) {
        context.log.error("Errore invio email Resend:", emailErr);
      }
    }

    context.res = {
      status: 200,

      body: { message: "Membro gruppo eliminato con successo!" },
    };
  } catch (err) {
    context.log.error("Errore RemoveGroupMember:", err);

    context.res = {
      status: 500,

      body: { error: `Errore SQL: ${err.message}` },
    };
  }
};
