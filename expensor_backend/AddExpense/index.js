const sql = require("mssql");
const { connectDB } = require("../db");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure function per gestire l'aggiunta di una spesa personale di un utente
 * **Funzionamento**
 * La funzione gestisce:
 * 1. Controllo e Preflight CORS con supporto credenziali (Cookie)
 * 2. Autenticazione tramite Cookie HttpOnly (`auth_token`)
 * 3. Validazione dei dati in ingresso
 * 4. Inserimento nel database usando l'ID utente estratto dal token
 * * @module Expenses
 * @param {object} context - Contesto di esecuzione di Azure Function
 * @param {object} req - Oggetto della richiesta HTTP
 * @param {string} req.headers.cookie - Cookie contenente il token JWT (`auth_token`)
 * @param {object} req.body - Corpo della richiesta; contiene i dati della spesa.
 * @param {number} req.body.amount - Importo della spesa.
 * @param {string} req.body.date - Data della spesa con formato (YYYY-MM-DD).
 * @param {string} req.body.description - Descrizione (opzionale).
 * @param {number} req.body.category_id - ID della categoria.
 * // NOTA: user_id rimosso dai parametri del body perché estratto dal token
 * * @returns {Promise<void>} Risponde con codice 201 in caso di successo, 400/401/500 in caso di errore
 */
module.exports = async function (context, req) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = req.headers["origin"];
  const originToUse =
    requestOrigin === allowedOrigin ? requestOrigin : allowedOrigin;

  const corsHeaders = {
    "Access-Control-Allow-Origin": originToUse,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Gestione Preflight
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
      context.log.warn("AddExpense: Cookie 'auth_token' mancante.");
      context.res = {
        status: 401,
        headers: corsHeaders,
        body: { error: "Non autenticato. Effettua il login." },
      };
      return;
    }

    const decodedToken = jwt.decode(token);
    if (!decodedToken || !decodedToken.oid) {
      context.res = {
        status: 401,
        headers: corsHeaders,
        body: { error: "Token non valido." },
      };
      return;
    }

    const currentUserId = decodedToken.oid;

    const { amount, date, description, category_id } = req.body;

    if (!amount || !date || !category_id) {
      context.log.warn("AddExpense: Campi obbligatori mancanti.");
      context.res = {
        status: 400,
        headers: corsHeaders,
        body: {
          error: "Campi obbligatori mancanti (amount, date, category_id).",
        },
      };
      return;
    }

    const pool = await connectDB();

    await pool
      .request()
      .input("amount", sql.Decimal(10, 2), amount)
      .input("date", sql.Date, date)
      .input("description", sql.NVarChar(255), description || "")
      .input("category_id", sql.Int, category_id)
      .input("user_id", sql.NVarChar(255), currentUserId) // Usiamo l'ID dal token
      .query(`
        INSERT INTO expenses (amount, date, description, category_id, user_id)
        VALUES (@amount, @date, @description, @category_id, @user_id)
      `);

    context.res = {
      status: 201,
      headers: corsHeaders,
      body: { message: "Spesa aggiunta con successo!" },
    };
  } catch (err) {
    context.log.error("Errore AddExpense:", err);

    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: `Errore SQL AddExpense: ${err.message}` },
    };
  }
};
