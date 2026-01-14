const { connectDB } = require("../db");
const sql = require("mssql");

/**
 * Azure Function per ottenere la lista completa di tutti gli utenti registrati.
 * * **Funzionalità:**
 * 1. **Gestione CORS:** Permette chiamate sicure dal frontend configurato.
 * 2. **Recupero Dati:** Esegue una `SELECT` semplice per ottenere ID, nome ed email di tutti gli utenti.
 * * @module Users
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP.
 * * @returns {Promise<void>}
 * - **200 OK**: Restituisce un array JSON con la lista degli utenti.
 * - **204 No Content**: Risposta per il preflight CORS.
 * - **500 Internal Server Error**: Errore di connessione o query SQL.
 */
module.exports = async function (context, req) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = req.headers["origin"];
  
  const corsHeaders = {
    "Access-Control-Allow-Origin":
      requestOrigin === allowedOrigin ? requestOrigin : "null",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") {
    context.res = {
      status: 204,
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-microsoft-id",
        "Access-Control-Max-Age": "86400",
      },
    };
    return;
  }

  try {
    const pool = await connectDB();

    const result = await pool.request()
      .query("SELECT id, microsoft_id, name, email FROM users");

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: result.recordset,
    };
  } catch (err) {
    context.log.error("Errore GetAllUsers:", err);

    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: `Errore durante il recupero degli utenti: ${err.message}` },
    };
  }
};