const { connectDB } = require("../db");
const sql = require("mssql");

/**
 * Azure Function per recuperare il profilo completo di un utente specifico.
 *
 * **Flusso di esecuzione:**
 * 1. **Validazione Input:** Verifica la presenza del parametro obbligatorio `microsoft_id` nella query string.
 * 2. **Interrogazione DB:** Esegue una query di selezione sulla tabella `users`.
 * 3. **Gestione Assenza:** Se l'ID non corrisponde a nessun record, restituisce un errore **404 Not Found**. Questo stato è spesso utilizzato dal frontend per determinare se un utente appena loggato deve essere ancora registrato nel DB locale.
 *
 * @module User
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 * @param {string} req.query.microsoft_id - L'ID univoco (Microsoft ID) dell'utente da recuperare.
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Restituisce un oggetto JSON con i dati dell'utente (`microsoft_id`, `email`, `name`, `created_at`, `profile_image_url`).
 * - **400 Bad Request**: Parametro `microsoft_id` mancante nella richiesta.
 * - **404 Not Found**: Nessun utente trovato nel database con l'ID fornito.
 * - **500 Internal Server Error**: Errore di connessione o query al database.
 */
module.exports = async function (context, req) {
  try {
    const pool = await connectDB();
    const microsoft_id = req.query.microsoft_id;

    if (!microsoft_id) {
      context.log.warn("GetUserInfo: Parametro 'microsoft_id' mancante");
      context.res = {
        status: 400,
        body: { error: "Parametro microsoft_id mancante" },
      };
      return;
    }

    const result = await pool.request().input("id", sql.NVarChar, microsoft_id)
      .query(`
                SELECT microsoft_id, email, name, created_at, profile_image_url 
                FROM users 
                WHERE microsoft_id = @id
            `);

    if (result.recordset.length === 0) {
      context.log.error("GetUserInfo: utente non trovato nel database");
      context.res = {
        status: 404,
        body: { error: "Utente non trovato nel database" },
      };
      return;
    }

    context.res = {
      status: 200,

      body: result.recordset[0],
    };
  } catch (err) {
    console.error("GetUserInfo: errore 500 interno: ", err);
    context.res = {
      status: 500,
      body: { error: `Errore interno server: ${err.message}` },
    };
  }
};
