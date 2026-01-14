const { connectDB } = require("../db");
const sql = require("mssql");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per registrare o autenticare un utente e avviare la sessione (Set-Cookie).
 * * **Funzionalità:**
 * 1. **Upsert Utente:** Verifica se l'utente esiste; se no, lo crea.
 * 2. **Sessione:** Genera un JWT firmato contenente l'ID utente.
 * 3. **Cookie:** Imposta il cookie `auth_token` (HttpOnly, Secure) nella risposta.
 * * @module Users
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP.
 * @param {object} req.body - Dati utente provenienti da MSAL.
 * @param {string} req.body.microsoft_id - ID univoco.
 * @param {string} req.body.email - Email dell'utente.
 * @param {string} req.body.name - Nome visualizzato.
 * * @returns {Promise<void>}
 * - **200 OK**: Login effettuato e Cookie impostato.
 * - **204 No Content**: Preflight CORS.
 * - **400 Bad Request**: Dati mancanti.
 * - **500 Internal Server Error**: Errore server.
 */

module.exports = async function (context, req) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = req.headers["origin"];
  
  const corsHeaders = {
    "Access-Control-Allow-Origin": requestOrigin === allowedOrigin ? requestOrigin : "null",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (req.method === "OPTIONS") {
    context.res = {
      status: 204,
      headers: corsHeaders,
    };
    return;
  }

  try {
    const { microsoft_id, email, name } = req.body;

    if (!microsoft_id || !email) {
      context.res = {
        status: 400,
        headers: corsHeaders,
        body: { error: "Dati mancanti per la creazione dell'utente" },
      };
      return;
    }

    const pool = await connectDB();

    const checkUser = await pool
      .request()
      .input("microsoft_id", sql.NVarChar, microsoft_id)
      .input("email", sql.NVarChar, email)
      .query("SELECT * FROM users WHERE microsoft_id = @microsoft_id OR email = @email");

    if (checkUser.recordset.length === 0) {
      await pool
        .request()
        .input("microsoft_id", sql.NVarChar(255), microsoft_id)
        .input("email", sql.NVarChar, email)
        .input("name", sql.NVarChar, name).query(`
            IF NOT EXISTS (SELECT 1 FROM users WHERE microsoft_id = @microsoft_id)
            BEGIN
                INSERT INTO users (microsoft_id, email, name, created_at)
                VALUES (@microsoft_id, @email, @name, GETDATE())
            END
        `);
    }

    const token = jwt.sign(
      { oid: microsoft_id, email: email, name: name },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    //const isProduction = process.env.NODE_ENV === "production";

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: { message: "Login effettuato con successo" },
      cookies: [
        {
          name: "auth_token",
          value: token,
          path: "/",
          httpOnly: true,
          secure: false, 
          sameSite: "Lax",
          maxAge: 28800 
        }
      ]
    };
  } catch (err) {
    context.log.error("Errore SaveUser:", err);
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: `Errore: ${err.message}` },
    };
  }
};