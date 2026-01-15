const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per cercare un utente nel database tramite il suo indirizzo email.
 *
 * **Contesto d'uso:**
 * Questa funzione è utilizzata principalmente nelle funzionalità di collaborazione (es. "Aggiungi Membro"), permettendo di trovare l'ID di un utente conoscendo solo la sua email.
 *
 * **Flusso di esecuzione:**
 * 1. **Autenticazione:** Verifica che la richiesta provenga da un utente autenticato controllando il cookie `auth_token`.
 * 2. **Validazione Input:** Controlla la presenza del parametro `email` nella query string.
 * 3. **Ricerca SQL:** Esegue una query `SELECT` filtrata per email. Restituisce solo i campi necessari (`microsoft_id`, `id`, `email`, `name`, `created_at`) per tutelare la privacy.
 *
 * @module User
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 * @param {string} req.query.email - L'indirizzo email dell'utente da cercare.
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Restituisce un array contenente l'oggetto utente trovato (o un array vuoto se nessun utente corrisponde).
 * - **400 Bad Request**: Parametro `email` mancante nella richiesta.
 * - **401 Unauthorized**: Cookie mancante o token non valido.
 * - **500 Internal Server Error**: Errore durante l'interazione con il database.
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

    const email = req.query.email;

    if (!email) {
      context.res = {
        status: 400,
        body: { error: "Parametro mail mancante" },
      };
      return;
    }

    const pool = await connectDB();
    const result = await pool.request().input("email", sql.NVarChar, email)
      .query(`
      SELECT microsoft_id, id, email, name, created_at
        FROM users u
        WHERE u.email = @email
    `);

    context.res = {
      status: 200,

      body: result.recordset,
    };
  } catch (err) {
    context.log.error("GetUserByMail: errore 500 interno", err);
    context.res = {
      status: 500,

      body: { error: `Errore nel recupero dell'utente: ${err.message}` },
    };
  }
};
