const { connectDB } = require("../db");
const sql = require("mssql");

/**
 * Azure Function per ottenere la lista completa di tutti gli utenti registrati nel sistema.
 *
 * **Flusso di esecuzione:**
 * 1. **Connessione Database:** Stabilisce la connessione al pool SQL.
 * 2. **Query:** Esegue una `SELECT` sulla tabella `users` recuperando i dati identificativi e di contatto (`id`, `microsoft_id`, `name`, `email`).
 *
 * @module User
 * @param {Object} context - Il contesto di esecuzione di Azure Function (logging e response).
 * @param {Object} req - L'oggetto richiesta HTTP (nessun parametro di input richiesto).
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Restituisce un array JSON contenente la lista degli utenti.
 * - **500 Internal Server Error**: Errore generico di connessione o query SQL fallita.
 */
module.exports = async function (context, req) {
  try {
    const pool = await connectDB();

    const result = await pool
      .request()
      .query("SELECT id, microsoft_id, name, email FROM users");

    context.res = {
      status: 200,

      body: result.recordset,
    };
  } catch (err) {
    context.log.error("Errore GetAllUsers:", err);

    context.res = {
      status: 500,

      body: {
        error: `Errore durante il recupero degli utenti: ${err.message}`,
      },
    };
  }
};
