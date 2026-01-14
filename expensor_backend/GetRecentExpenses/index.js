const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper"); // Assicurati che il percorso sia corretto
const jwt = require("jsonwebtoken");

/**
 * Azure Function per recuperare le ultime 5 spese effettuate dall'utente (per la Dashboard).
 * * **Funzionalità:**
 * 1. **Filtro Temporale:** Utilizza `SELECT TOP 5` combinato con `ORDER BY e.date DESC` per ottenere solo le voci più recenti.
 * 2. **Join Dati:** Unisce la tabella `expenses` con `categories` per mostrare il nome della categoria.
 * 3. **Sicurezza:** Identifica l'utente decodificando il token JWT presente nel cookie `auth_token`.
 * * @module Expenses
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP.
 * @param {string} req.headers.cookie - Il cookie contenente `auth_token` (Gestito automaticamente dal browser).
 * * @returns {Promise<void>}
 * - **200 OK**: Restituisce un array JSON con le 5 spese più recenti.
 * - **204 No Content**: Preflight CORS.
 * - **401 Unauthorized**: Cookie mancante o token non valido.
 * - **500 Internal Server Error**: Errore server o database.
 */
module.exports = async function (context, req) {
  // 1. GESTIONE CORS AVANZATA (Necessaria per i cookie)
  // Non possiamo usare "*" quando credentials è true.
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

  // Gestione Preflight Request
  if (req.method === "OPTIONS") {
    context.res = {
      status: 204,
      headers: corsHeaders,
    };
    return;
  }

  try {
    // 2. RECUPERO TOKEN DAL COOKIE
    const cookies = parseCookies(req);
    const token = cookies["auth_token"];

    if (!token) {
      context.log.warn("GetRecentExpenses: Cookie 'auth_token' mancante");
      context.res = {
        status: 401,
        headers: corsHeaders,
        body: { error: "Non autenticato: Sessione scaduta o mancante." },
      };
      return;
    }

    // 3. DECODIFICA TOKEN
    const decodedToken = jwt.decode(token);
    if (!decodedToken || !decodedToken.oid) {
      context.res = {
        status: 401,
        headers: corsHeaders,
        body: { error: "Token non valido." },
      };
      return;
    }

    const user_id = decodedToken ? decodedToken.oid : null;
    if (!user_id) {
      context.res = {
        status: 401,
        headers: corsHeaders,
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
      headers: corsHeaders,
      body: result.recordset,
    };
  } catch (err) {
    context.log.error("GetRecentExpenses: errore 500 interno", err);
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: {
        error: `Errore nel recupero delle spese recenti: ${err.message}`,
      },
    };
  }
};
