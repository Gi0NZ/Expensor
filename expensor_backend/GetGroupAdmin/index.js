const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per recuperare le informazioni dell'amministratore di un gruppo specifico.
 *
 * **Flusso di esecuzione:**
 * 1. **Autenticazione:** Verifica la presenza e la validità del cookie `auth_token` per identificare l'utente richiedente.
 * 2. **Validazione Input:** Controlla che il parametro `group_id` sia presente nella query string.
 * 3. **Recupero Dati:** Esegue una query SQL con `JOIN` tra le tabelle `groups` e `users` per recuperare i dettagli (ID e Nome) dell'amministratore associato a quel gruppo.
 *
 * @module GroupManagement
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 * @param {string|number} req.query.group_id - L'ID univoco del gruppo di cui si cerca l'admin.
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Restituisce un array di oggetti contenente: `{ admin (Microsoft ID), id (Group ID), name (Admin Name) }`.
 * - **400 Bad Request**: Parametro `group_id` mancante nella richiesta.
 * - **401 Unauthorized**: Cookie mancante o token non valido.
 * - **500 Internal Server Error**: Errore durante l'interazione con il database.
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

    const group_id = req.query.group_id;

    if (!group_id) {
      context.res = {
        status: 400,
        body: { error: "Parametro group_id mancante" },
      };
      return;
    }

    const pool = await connectDB();

    const result = await pool.request().input("group_id", sql.Int, group_id)
      .query(`
        SELECT 
          g.admin,
          g.id,
          u.name
        FROM groups g
        JOIN users u ON g.admin = u.microsoft_id
        WHERE g.id = @group_id
    `);

    context.res = {
      status: 200,

      body: result.recordset,
    };
  } catch (err) {
    context.log.error("GetGroupAdmin: errore 500 interno", err);
    context.res = {
      status: 500,

      body: {
        error: `Errore nel recupero dell'admin del gruppo: ${err.message}`,
      },
    };
  }
};
