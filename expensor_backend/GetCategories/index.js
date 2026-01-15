const { connectDB } = require("../db");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per recuperare l'elenco completo delle categorie di spesa.
 *
 * **Flusso di esecuzione:**
 * 1. **Autenticazione:** Estrae il cookie `auth_token` e ne verifica la validità tramite decoding JWT.
 * 2. **Recupero Dati:** Interroga il database per ottenere tutte le righe della tabella `categories`.
 * 3. **Output:** Restituisce un array JSON contenente le categorie (id, nome, icona, ecc.).
 *
 * @module Expenses
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Restituisce il `recordset` (array) delle categorie.
 * - **401 Unauthorized**: Cookie mancante o sessione JWT non valida.
 * - **500 Internal Server Error**: Errore durante la connessione o la query al DB.
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
    const decoded = jwt.decode(token);
    if (!decoded) {
      context.res = {
        status: 401,

        body: { error: "Sessione non valida." },
      };
      return;
    }

    const pool = await connectDB();

    const result = await pool.request().query("SELECT * FROM categories");

    context.res = {
      status: 200,

      body: result.recordset,
    };
  } catch (err) {
    context.log.error("Errore GetCategories:", err);

    context.res = {
      status: 500,

      body: { error: `Errore nel recupero delle categorie: ${err.message}` },
    };
  }
};