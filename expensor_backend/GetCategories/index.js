const { connectDB } = require("../db");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per recuperare la lista delle categorie di spesa.
 * * **Funzionamento:**
 * 1. **Gestione CORS:** Gestione preflight CORS con supporto credenziali (Cookie).
 * 2. **Autenticazione:** Verifica la presenza del cookie di sessione (`auth_token`).
 * 3. **Recupero Dati:** Esegue una semplice query `SELECT` per ottenere tutte le categorie.
 * 4. **Pulizia Risposta:** Restituisce al frontend solo l'array dei dati (`recordset`).
 * * @module Expenses
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP.
 * @param {string} req.headers.cookie - Cookie contenente il token JWT (`auth_token`).
 * * @returns {Promise<void>}
 * - **200 OK**: Restituisce un array JSON con le categorie.
 * - **204 No Content**: Gestione preflight CORS.
 * - **401 Unauthorized**: Utente non autenticato (cookie mancante o invalido).
 * - **500 Internal Server Error**: Errore di connessione al DB.
 */
module.exports = async function (context, req) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = req.headers["origin"];
  const originToUse =
    requestOrigin === allowedOrigin ? requestOrigin : allowedOrigin;

  const corsHeaders = {
    "Access-Control-Allow-Origin": originToUse,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    context.res = {
      status: 204,
      headers: corsHeaders,
    };
    return;
  }

  try {
    const cookies = parseCookies(req);
    const token = cookies["auth_token"];

    if (!token) {
      context.res = {
        status: 401,
        headers: corsHeaders,
        body: { error: "Non autenticato." },
      };
      return;
    }
    const decoded = jwt.decode(token);
    if (!decoded) {
      context.res = {
        status: 401,
        headers: corsHeaders,
        body: { error: "Sessione non valida." },
      };
      return;
    }

    const pool = await connectDB();

    const result = await pool.request().query("SELECT * FROM categories");

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: result.recordset,
    };
  } catch (err) {
    context.log.error("Errore GetCategories:", err);

    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: `Errore nel recupero delle categorie: ${err.message}` },
    };
  }
};
