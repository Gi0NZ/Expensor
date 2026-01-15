const { connectDB, sql } = require("../db");

/**
 * Azure Function per eliminare una spesa personale dal database.
 *
 * **Flusso di esecuzione:**
 * 1. **Validazione Input:** Controlla che il parametro `id` sia presente nel corpo della richiesta (`req.body`).
 * 2. **Operazione Database:** Stabilisce una connessione ed esegue il comando SQL `DELETE` parametrizzato per rimuovere la riga corrispondente dalla tabella `expenses`.
 *
 * @module Expenses
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 * @param {Object} req.body - Il payload della richiesta.
 * @param {number} req.body.id - L'ID univoco della spesa da eliminare.
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Eliminazione avvenuta con successo.
 * - **400 Bad Request**: Parametro `id` mancante nel body.
 * - **500 Internal Server Error**: Errore di connessione o esecuzione della query SQL.
 */
module.exports = async function (context, req) {
  try {
    const { id } = req.body;

    if (!id) {
      context.res = {
        status: 400,

        body: { error: "Campi obbligatori mancanti (id)." },
      };
      return;
    }
    const pool = await connectDB();

    await pool.request().input("id", sql.Int, id).query(`
        DELETE FROM expenses WHERE id = @id
    `);

    context.res = {
      status: 200,

      body: { message: "Spesa eliminata con successo!" },
    };
  } catch (err) {
    context.log.error("RemoveExpenses: errore 500 interno, ", err);

    context.res = {
      status: 500,

      body: { error: `Errore SQL: ${err.message}` },
    };
  }
};
