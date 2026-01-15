const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per eliminare definitivamente un gruppo di spesa.
 *
 * **Flusso di esecuzione:**
 * 1. **Autenticazione:** Recupera il token JWT dal cookie `auth_token` e decodifica l'ID utente (`oid`).
 * 2. **Validazione Input:** Verifica che `group_id` sia presente nel corpo della richiesta.
 * 3. **Verifica Proprietà (RBAC):**
 * - Esegue una query di selezione per trovare l'admin del gruppo.
 * - Se il gruppo non esiste, restituisce **404**.
 * - Confronta l'ID dell'utente richiedente con l'admin del gruppo. Se non coincidono, blocca l'operazione con **403 Forbidden**.
 * 4. **Cancellazione:** Se i controlli passano, esegue la `DELETE` rimuovendo il gruppo (e a cascata i dati correlati, in base alla configurazione delle Foreign Key del DB).
 *
 * @module GroupManagement
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 * @param {Object} req.body - Il payload della richiesta.
 * @param {number} req.body.group_id - L'ID univoco del gruppo da eliminare.
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Gruppo eliminato con successo.
 * - **400 Bad Request**: Parametro `group_id` mancante.
 * - **401 Unauthorized**: Cookie mancante o token non valido.
 * - **403 Forbidden**: L'utente richiedente non è l'amministratore del gruppo.
 * - **404 Not Found**: Il gruppo specificato non esiste.
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

    const requestingUserId = decodedToken.oid;
    const { group_id } = req.body;

    if (!group_id) {
      context.res = {
        status: 400,
        body: { error: "Dati mancanti: group_id mancante." },
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
      };
      return;
    }

    const groupOwner = checkResult.recordset[0].admin;

    if (groupOwner !== requestingUserId) {
      context.log.warn(
        `Tentativo di cancellazione non autorizzato. User: ${requestingUserId}, GroupOwner: ${groupOwner}`
      );
      context.res = {
        status: 403,
        body: {
          error:
            "Non hai i permessi per eliminare questo gruppo. Solo l'admin può farlo.",
        },
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
    };
  } catch (err) {
    context.log.error("Errore RemoveGroup:", err);
    context.res = {
      status: 500,

      body: { error: "Errore interno server: " + err.message },
    };
  }
};
