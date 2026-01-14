const { connectDB } = require("../db");
const sql = require("mssql");

/**
 * Azure Function per recuperare il profilo completo di un utente.
 * * **Funzionalità:**
 * 1. **Recupero Dati:** Restituisce ID, email, nome, data registrazione e immagine profilo.
 * 2. **Gestione 404:** Se l'ID fornito non esiste nel database, restituisce un errore specifico (utile per gestire nuovi utenti al primo login).
 * 3. **Input:** Accetta il parametro `microsoft_id` via query string (GET).
 * * @module User
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP.
 * @param {string} req.query.microsoft_id - L'ID univoco dell'utente da recuperare.
 * * @returns {Promise<void>}
 * - **200 OK**: Restituisce un oggetto JSON con i dati dell'utente.
 * - **204 No Content**: Preflight CORS.
 * - **400 Bad Request**: Parametro `microsoft_id` mancante.
 * - **404 Not Found**: Utente non trovato nel database.
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
    const pool = await connectDB();
    const microsoft_id = req.query.microsoft_id;

    if (!microsoft_id) {
      context.log.warn("GetUserInfo: Parametro 'microsoft_id' mancante");
      context.res = {
        status: 400,
        body: { error: "Parametro microsoft_id mancante" },
        headers: corsHeaders,
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
        headers: corsHeaders,
      };
      return;
    }

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: result.recordset[0],
    };
  } catch (err) {
    console.error("GetUserInfo: errore 500 interno: ", err);
    context.res = {
      status: 500,
      body: { error: `Errore interno server: ${err.message}` },
      headers: corsHeaders,
    };
  }
};
