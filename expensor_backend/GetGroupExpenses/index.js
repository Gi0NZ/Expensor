const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per recuperare lo storico completo delle spese associate a uno specifico gruppo.
 *
 * **Flusso di esecuzione:**
 * 1. **Autenticazione:** Verifica la validità del token JWT estratto dal cookie `auth_token`.
 * 2. **Validazione Input:** Controlla la presenza del parametro obbligatorio `group_id` nella query string.
 * 3. **Recupero Dati:** Esegue una query `SELECT *` sulla tabella `group_expenses` filtrando per l'ID del gruppo fornito.
 *
 * @module GroupExpenses
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 * @param {string|number} req.query.group_id - L'ID univoco del gruppo di cui visualizzare le spese.
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Restituisce un array JSON contenente le righe della tabella `group_expenses`.
 * - **400 Bad Request**: Parametro `group_id` mancante.
 * - **401 Unauthorized**: Cookie mancante o token non valido.
 * - **500 Internal Server Error**: Errore durante l'esecuzione della query SQL.
 */
module.exports = async function (context, req) {
  try {
    const cookies = parseCookies(req);
    const token = cookies['auth_token'];

    if (!token) {
      context.res = {
        status: 401,
        
        body: { error: "Non autenticato." }
      };
      return;
    }

    const decodedToken = jwt.decode(token);
    if (!decodedToken || !decodedToken.oid) {
      context.res = {
        status: 401,
        
        body: { error: "Token non valido." }
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
        SELECT *
        FROM group_expenses ge
        WHERE ge.group_id = @group_id
    `);

    context.res = {
      status: 200,
      
      body: result.recordset,
    };
  } catch (err) {
    context.log.error("GetGroupExpense: errore 500 interno", err);
    context.res = {
      status: 500,
      
      body: { error: `Errore nel recupero delle spese: ${err.message}` },
    };
  }
};