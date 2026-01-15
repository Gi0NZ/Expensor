const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper"); // Assicurati che il percorso sia corretto
const jwt = require("jsonwebtoken");

/**
 * Azure Function per recuperare le ultime 5 spese effettuate dall'utente (ottimizzata per la Dashboard).
 *
 * **Flusso di esecuzione:**
 * 1. **Autenticazione:** Recupera il token JWT dal cookie `auth_token` ed estrae l'ID utente (`oid`).
 * 2. **Recupero Dati:** Esegue una query SQL utilizzando `SELECT TOP 5` per limitare il numero di risultati.
 * 3. **Arricchimento:** Effettua una `INNER JOIN` con la tabella `categories` per restituire il nome leggibile della categoria invece del solo ID.
 * 4. **Ordinamento:** I risultati sono ordinati cronologicamente in senso decrescente (`ORDER BY e.date DESC`).
 *
 * @module Expenses
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Restituisce un array JSON contenente le 5 spese più recenti (con i campi: id, user_id, description, amount, date, category_name).
 * - **401 Unauthorized**: Cookie mancante, token scaduto o ID utente non valido.
 * - **500 Internal Server Error**: Errore di connessione al database o errore SQL.
 */
module.exports = async function (context, req) {
  try {
    const cookies = parseCookies(req);
    const token = cookies["auth_token"];

    if (!token) {
      context.log.warn("GetRecentExpenses: Cookie 'auth_token' mancante");
      context.res = {
        status: 401,

        body: { error: "Non autenticato: Sessione scaduta o mancante." },
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

    const user_id = decodedToken ? decodedToken.oid : null;
    if (!user_id) {
      context.res = {
        status: 401,

        body: { error: "Token non valido: ID utente mancante." },
      };
      return;
    }

    const pool = await connectDB();

    const result = await pool
      .request()
      .input("microsoft_id", sql.NVarChar, user_id).query(`
        SELECT TOP 5
            e.id,
            e.user_id,
            e.description,
            e.amount,
            e.date,
            c.name AS category_name
        FROM expenses e
        INNER JOIN categories c ON e.category_id = c.id
        WHERE e.user_id = @microsoft_id
        ORDER BY e.date DESC
      `);

    context.res = {
      status: 200,

      body: result.recordset,
    };
  } catch (err) {
    context.log.error("GetRecentExpenses: errore 500 interno", err);
    context.res = {
      status: 500,

      body: {
        error: `Errore nel recupero delle spese recenti: ${err.message}`,
      },
    };
  }
};
