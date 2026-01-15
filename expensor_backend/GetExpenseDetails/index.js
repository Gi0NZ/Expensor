const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per recuperare i dettagli puntuali di una specifica spesa di gruppo.
 *
 * **Flusso di esecuzione:**
 * 1. **Autenticazione:** Verifica la validità del token JWT estratto dai cookie.
 * 2. **Validazione Input:** Controlla la presenza dei parametri `groupId` ed `expenseId` nella query string dell'URL.
 * 3. **Query Relazionale:** Esegue una `SELECT` con `JOIN` sulla tabella `users`. Questo permette di restituire, oltre ai dati della spesa, anche il nome leggibile (`paid_by_name`) dell'utente che ha saldato il conto.
 *
 * @module GroupExpenses
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 * @param {Object} req.query - I parametri della query string (es. `?groupId=1&expenseId=5`).
 * @param {string|number} req.query.groupId - L'ID del gruppo a cui appartiene la spesa.
 * @param {string|number} req.query.expenseId - L'ID univoco della spesa da recuperare.
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Restituisce l'oggetto spesa completo (incluso il campo calcolato `paid_by_name`).
 * - **400 Bad Request**: Parametri query mancanti.
 * - **401 Unauthorized**: Cookie `auth_token` mancante o invalido.
 * - **500 Internal Server Error**: Errore di connessione al DB o query fallita.
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
    const groupId = req.query.groupId;
    const expenseId = req.query.expenseId;

    if (!groupId || !expenseId) {
      context.res = {
        status: 400,

        body: { error: "Parametri groupId o expenseId mancanti." },
      };
      return;
    }

    const result = await pool
      .request()
      .input("group_id", sql.Int, groupId)
      .input("expense_id", sql.Int, expenseId).query(`
            SELECT ge.*, u.name as paid_by_name 
            FROM group_expenses ge
            JOIN users u ON ge.paid_by = u.microsoft_id
            WHERE ge.id = @expense_id
            AND ge.group_id = @group_id
        `);

    context.res = {
      status: 200,

      body: result.recordset[0],
    };
  } catch (err) {
    context.log.error("Errore GetExpenseDetails:", err);

    context.res = {
      status: 500,

      body: { error: `Errore nel recupero delle spese: ${err.message}` },
    };
  }
};