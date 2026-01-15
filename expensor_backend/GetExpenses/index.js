const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per recuperare lo storico delle spese personali dell'utente autenticato.
 *
 * **Flusso di esecuzione:**
 * 1. **Autenticazione:** Estrae il token JWT dal cookie `auth_token` per identificare l'utente (`oid`).
 * 2. **Recupero Dati:** Esegue una query sulla tabella `expenses` filtrando per `user_id`.
 * 3. **Arricchimento Dati:** Effettua una `INNER JOIN` con la tabella `categories` per includere il nome leggibile della categoria (`category_name`) nei risultati.
 * 4. **Ordinamento:** Restituisce i risultati ordinati per data decrescente (dal più recente).
 *
 * @module Expenses
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Restituisce un array JSON contenente le spese (con dettagli categoria).
 * - **401 Unauthorized**: Cookie mancante o token non valido.
 * - **500 Internal Server Error**: Errore durante l'esecuzione della query.
 */
module.exports = async function (context, req) {
  try {
    const cookies = parseCookies(req);
    const token = cookies["auth_token"];

    if (!token) {
      context.res = {
        status: 401,

        body: { error: "Non autenticato" },
      };
      return;
    }

    const decoded = jwt.decode(token);

    const user_id = decoded.oid;

    const pool = await connectDB();

    const result = await pool.request().input("user_id", sql.NVarChar, user_id)
      .query(`
        SELECT e.id,
             e.user_id, 
             e.description, 
             e.amount, 
             e.date, 
             c.name as category_name, 
             c.id as cat_id
        FROM expenses e
        INNER JOIN categories c ON e.category_id = c.id
        WHERE e.user_id = @user_id
        ORDER BY e.date DESC
      `);

    context.res = {
      status: 200,

      body: result.recordset,
    };
  } catch (err) {
    context.log.error("GetExpenses: Errore", err);
    context.res = {
      status: 500,

      body: { error: err.message },
    };
  }
};