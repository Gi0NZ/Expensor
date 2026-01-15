const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per recuperare le informazioni generali di un gruppo (es. nome, data creazione, admin).
 *
 * **Flusso di esecuzione:**
 * 1. **Autenticazione:** Verifica la validità del token JWT (`auth_token`) estratto dai cookie.
 * 2. **Validazione Input:** Controlla la presenza del parametro obbligatorio `group_id` nella query string.
 * 3. **Recupero Dati:** Esegue una query `SELECT *` sulla tabella `groups` filtrando per l'ID fornito.
 *
 * @module GroupManagement
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 * @param {string|number} req.query.group_id - L'ID univoco del gruppo da recuperare.
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Restituisce un array contenente l'oggetto gruppo (di solito un singolo record).
 * - **400 Bad Request**: Parametro `group_id` mancante.
 * - **401 Unauthorized**: Cookie mancante o token non valido.
 * - **500 Internal Server Error**: Errore di connessione o query al database.
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
      context.log.warn("GetGroupInfo: parametro group_id mancante");
      context.res = {
        status: 400,
        body: { error: "Parametro group_id mancante" },
      };
      return;
    }

    const pool = await connectDB();

    const result = await pool.request().input("group_id", sql.Int, group_id)
      .query(`
        SELECT *
        FROM groups g
        WHERE g.id = @group_id
    `);

    context.res = {
      status: 200,

      body: result.recordset,
    };
  } catch (err) {
    context.log.error("GetGroupInfo: errore 500 interno", err);
    context.res = {
      status: 500,

      body: {
        error: {
          error: `Errore nel recupero delle informazioni del gruppo: ${err.message}`,
        },
      },
    };
  }
};