const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per recuperare la ripartizione (split) di una specifica spesa di gruppo.
 *
 * **Flusso di esecuzione:**
 * 1. **Autenticazione:** Verifica la validità del token JWT presente nei cookie.
 * 2. **Risoluzione Input:** Cerca l'ID della spesa (`expenseId`) prima nella query string, poi nel corpo della richiesta.
 * 3. **Recupero Dati:** Esegue una query sulla tabella `group_expense_shares` effettuando una **JOIN** con la tabella `users`.
 * Questo permette di restituire non solo gli ID e gli importi, ma anche i nomi e le email degli utenti coinvolti.
 *
 * @module GroupExpenses
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 * @param {string|number} [req.query.expenseId] - L'ID della spesa (metodo preferito).
 * @param {string|number} [req.body.expenseId] - L'ID della spesa (fallback se non presente in query).
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Restituisce un array di oggetti contenente: `{ user_id, amount, last_updated, user_name, user_email }`.
 * - **400 Bad Request**: Parametro `expenseId` mancante sia in query che nel body.
 * - **401 Unauthorized**: Cookie mancante o token non valido.
 * - **500 Internal Server Error**: Errore durante l'esecuzione della query SQL.
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

    const pool = await connectDB();
    const expense_id = req.query.expenseId || req.body.expenseId;

    if (!expense_id) {
      context.log.warn(`GetExpenseSplit: ID spesa mancante`);
      context.res = {
        status: 400,
        body: { error: "ID spesa mancante" },
      };
      return;
    }

    const result = await pool.request().input("expId", sql.Int, expense_id)
      .query(`
            SELECT 
                ges.user_id, 
                ges.share_amount as amount, 
                ges.last_updated,
                u.name as user_name,
                u.email as user_email
            FROM group_expense_shares ges
            JOIN users u ON ges.user_id = u.microsoft_id
            WHERE ges.expense_id = @expId
        `);

    context.res = {
      status: 200,
      body: result.recordset,
    };
  } catch (err) {
    context.log.error("GetExpenseSplit: errore 500 Interno", err);
    context.res = {
      status: 500,
      body: { error: `Errore nel recupero degli split ${err.message}` },
    };
  }
};
