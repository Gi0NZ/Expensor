const { connectDB } = require("../db");
const sql = require("mssql");
const { Resend } = require("resend");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");
const { addedNotify } = require("../utils/addedNotify");

/**
 * Azure Function per aggiungere un utente a un gruppo esistente e notificargli l'evento.
 *
 * **Flusso di Esecuzione:**
 * 1. **Autenticazione:** Verifica la validità del token JWT presente nei cookie.
 * 2. **Autorizzazione (RBAC):** Controlla che l'utente richiedente sia l'**Admin** del gruppo.
 * 3. **Inserimento (Atomic):** Tenta di inserire il record nella tabella `group_members`.
 * - Se l'utente è già presente, intercetta l'errore SQL 2627 e restituisce **409 Conflict**.
 * 4. **Notifica Email:** Recupera i dettagli utente/gruppo e invia una mail di benvenuto tramite **Resend** (azione *best-effort*, non blocca la risposta in caso di errore).
 *
 * @module GroupMembers
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 * @param {Object} req.body - Il payload della richiesta.
 * @param {number} req.body.group_id - L'ID univoco del gruppo.
 * @param {string} req.body.microsoft_id - L'ID Microsoft (UUID) dell'utente da aggiungere.
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Utente aggiunto con successo (email inviata o loggato errore invio).
 * - **400 Bad Request**: Parametri `group_id` o `microsoft_id` mancanti.
 * - **401 Unauthorized**: Token mancante o invalido.
 * - **403 Forbidden**: L'utente richiedente non è l'amministratore del gruppo.
 * - **404 Not Found**: Il gruppo specificato non esiste.
 * - **409 Conflict**: L'utente fa già parte del gruppo.
 * - **500 Internal Server Error**: Errore generico del server.
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

    const requestingUserId = decodedToken.oid;
    const { group_id, microsoft_id } = req.body;
    const frontendBase = process.env.FRONTEND_URL;

    if (!group_id || !microsoft_id) {
      context.res = {
        status: 400,
        body: { error: "Dati mancanti" },
      };
      return;
    }

    const pool = await connectDB();

    const groupCheck = await pool
      .request()
      .input("gid", sql.Int, group_id)
      .query("SELECT admin FROM groups WHERE id = @gid");

    if (groupCheck.recordset.length === 0) {
      context.res = {
        status: 404,

        body: { error: "Gruppo non trovato." },
      };
      return;
    }

    const groupAdmin = groupCheck.recordset[0].admin;

    if (groupAdmin !== requestingUserId) {
      context.res = {
        status: 403,

        body: {
          error: "Non autorizzato: Solo l'Admin può aggiungere membri.",
        },
      };
      return;
    }

    try {
      await pool
        .request()
        .input("gid", sql.Int, group_id)
        .input("uid", sql.NVarChar, microsoft_id).query(`
            INSERT INTO group_members (group_id, user_id)
            VALUES (@gid, @uid)
        `);
    } catch (sqlErr) {
      if (sqlErr.number === 2627) {
        context.res = {
          status: 409,
          body: { error: "L'utente fa già parte del gruppo." },
        };
        return;
      }
      throw sqlErr;
    }

    const infoResult = await pool
      .request()
      .input("gid", sql.Int, group_id)
      .input("uid", sql.NVarChar, microsoft_id).query(`
          SELECT u.email, u.name as user_name, g.name as group_name
          FROM users u, groups g
          WHERE u.microsoft_id = @uid AND g.id = @gid
      `);

    const adminInfo = await pool
      .request()
      .input("m_id", sql.NVarChar, groupAdmin).query(`
      SELECT * 
      FROM users u
      WHERE u.microsoft_id = @m_id
      `);

    if (infoResult.recordset.length > 0) {
      const { email, user_name, group_name } = infoResult.recordset[0];

      const adminMail = adminInfo.recordset[0].email;
      const adminName = adminInfo.recordset[0].name;
      const senderEmail = process.env.SENDER_EMAIL;
      const groupLink = `${frontendBase}/groupHandling/${group_id}`;

      try {
        await addedNotify(
          email,
          user_name,
          senderEmail,
          adminMail,
          adminName,
          group_name,
          groupLink,
        );
      } catch (emailErr) {
        context.log.error("Errore invio email Resend:", emailErr);
      }
    }

    context.res = {
      status: 200,
      body: { message: "Membro aggiunto con successo" },
    };
  } catch (err) {
    context.log.error("Errore AddGroupMember:", err);
    context.res = {
      status: 500,
      body: { error: "Errore interno server: " + err.message },
    };
  }
};
