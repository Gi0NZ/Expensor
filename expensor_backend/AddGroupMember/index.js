const { connectDB } = require("../db");
const sql = require("mssql");
const { Resend } = require("resend");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per aggiungere un utente a un gruppo esistente e comunicandogli l'aggiunta tramite mail.
 * * **Funzionamento:**
 * 1. **Gestione CORS:** Verifica l'origine e gestisce il preflight `OPTIONS` con credenziali.
 * 2. **Sicurezza:** Identifica chi fa la richiesta tramite Cookie. Solo l'**Admin** del gruppo può aggiungere membri.
 * 3. **Inserimento Membro:** Tenta di inserire il record nella tabella `group_members`.
 * - *Gestione Conflitti:* Se l'utente è già nel gruppo, restituisce **409 Conflict**.
 * 4. **Invio Email:** Utilizza Resend per notificare l'utente.
 * * @module GroupMembers
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP.
 * @param {string} req.headers.cookie - Il cookie contenente il token di sessione.
 * @param {object} req.body - Il corpo della richiesta.
 * @param {number} req.body.group_id - L'ID del gruppo in cui inserire l'utente.
 * @param {string} req.body.microsoft_id - Il Microsoft ID dell'utente da aggiungere.
 * * @returns {Promise<void>}
 * - **200 OK**: Utente aggiunto con successo.
 * - **400 Bad Request**: Parametri mancanti.
 * - **401 Unauthorized**: Cookie mancante o invalido.
 * - **403 Forbidden**: L'utente richiedente non è l'admin del gruppo.
 * - **409 Conflict**: L'utente fa già parte del gruppo.
 * - **500 Internal Server Error**: Errore generico.
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

    const requestingUserId = decodedToken.oid;
    const { group_id, microsoft_id } = req.body;
    const frontendBase = process.env.FRONTEND_URL;

    if (!group_id || !microsoft_id) {
      context.res = {
        status: 400,
        body: { error: "Dati mancanti" },
        headers: corsHeaders,
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
        headers: corsHeaders,
        body: { error: "Gruppo non trovato." },
      };
      return;
    }

    const groupAdmin = groupCheck.recordset[0].admin;

    if (groupAdmin !== requestingUserId) {
      context.res = {
        status: 403,
        headers: corsHeaders,
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
            INSERT INTO group_members (group_id, user_id, contributed_amount, owed_amount, settled_amount)
            VALUES (@gid, @uid, 0, 0, 0)
        `);
    } catch (sqlErr) {
      if (sqlErr.number === 2627) {
        context.res = {
          status: 409,
          body: { error: "L'utente fa già parte del gruppo." },
          headers: corsHeaders,
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

    if (infoResult.recordset.length > 0) {
      const { email, user_name, group_name } = infoResult.recordset[0];

      const resend = new Resend(process.env.RESEND_API_KEY);
      const senderEmail = process.env.SENDER_EMAIL;
      const groupLink = `${frontendBase}/groupHandling/${group_id}`;
      try {
        await resend.emails.send({
          from: `Expensor App <${senderEmail}>`,
          to: [email],
          subject: `Sei stato aggiunto al gruppo: ${group_name} 🎉`,
          html: `
              <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                  <h2 style="color: #4CAF50;">Benvenuto nel gruppo!</h2>
                  <p>Ciao <strong>${user_name}</strong>,</p>
                  <p>Sei stato aggiunto con successo al gruppo di spesa <strong>"${group_name}"</strong> su Expensor.</p>
                  <p>Accedi subito per vedere le spese e aggiungere la tua parte.</p>
                  <br/>
                  <a href="${groupLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Vai al Gruppo</a>
                  <p style="font-size: 0.8rem; color: #999; margin-top: 30px;">Se pensi sia un errore, contatta l'amministratore del gruppo.</p>
              </div>
          `,
        });
      } catch (emailErr) {
        context.log.error("Errore invio email Resend:", emailErr);
      }
    }

    context.res = {
      status: 200,
      body: { message: "Membro aggiunto con successo" },
      headers: corsHeaders,
    };
  } catch (err) {
    context.log.error("Errore AddGroupMember:", err);
    context.res = {
      status: 500,
      body: { error: "Errore interno server: " + err.message },
      headers: corsHeaders,
    };
  }
};
