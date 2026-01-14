const { connectDB, sql } = require("../db");

/**
 * Azure Function per eliminare una spesa personale dal database.
 * * **Funzionalità:**
 * 1. **Gestione CORS:** Permette chiamate sicure e gestisce il preflight.
 * 2. **Validazione:** Controlla che l'ID della spesa sia presente nel corpo della richiesta.
 * 3. **Cancellazione:** Esegue il comando SQL `DELETE` parametrizzato.
 * * @module Expenses
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP.
 * @param {object} req.body - Il corpo della richiesta.
 * @param {number} req.body.id - L'ID univoco della spesa da eliminare.
 * * @returns {Promise<void>}
 * - **200 OK**: Spesa eliminata con successo.
 * - **204 No Content**: Preflight CORS.
 * - **400 Bad Request**: Parametro `id` mancante.
 * - **500 Internal Server Error**: Errore server o database.
 */

module.exports = async function (context, req) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = req.headers["origin"];
  const corsHeaders = {
    "Access-Control-Allow-Origin":
      requestOrigin === allowedOrigin ? requestOrigin : "null",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    context.res = {
      status: 204,
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, x-microsoft-id",
        "Access-Control-Max-Age": "86400",
      },
    };
    return;
  }

  try {
    const { id } = req.body;

    if (!id) {
      context.res = {
        status: 400,
        headers: corsHeaders,
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
      headers: corsHeaders,
      body: { message: "Spesa eliminata con successo!" },
    };
  } catch (err) {
    context.log.error("RemoveExpenses: errore 500 interno, ", err);

    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: `Errore SQL: ${err.message}` },
    };
  }
};
