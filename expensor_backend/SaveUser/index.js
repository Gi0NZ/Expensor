const { connectDB } = require("../db");
const sql = require("mssql");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per gestire il Login/Registrazione (Sign-in/Sign-up) dell'utente.
 *
 * **Flusso di esecuzione:**
 * 1. **Validazione Input:** Verifica la presenza di `microsoft_id` ed `email`.
 * 2. **Check-or-Create (Idempotenza):**
 * - Verifica se l'utente esiste già nel database.
 * - Se non esiste, lo inserisce (registrazione al primo accesso).
 * 3. **Generazione Sessione:**
 * - Crea un **JWT** (JSON Web Token) firmato con una durata di 8 ore.
 * - Imposta il token in un cookie `HttpOnly` chiamato `auth_token`.
 *
 * **Nota sui Cookie:**
 * Il cookie viene impostato come `HttpOnly` per prevenire attacchi XSS (non accessibile via JS lato client) e `SameSite=Lax` per bilanciare sicurezza e usabilità.
 *
 * @module Users
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 * @param {Object} req.body - Payload contenente i dati utente (solitamente da MSAL/Frontend).
 * @param {string} req.body.microsoft_id - ID univoco dell'utente (Subject ID di Azure AD).
 * @param {string} req.body.email - L'indirizzo email dell'utente.
 * @param {string} [req.body.name] - Il nome visualizzato dell'utente.
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Login successo. Include l'header `Set-Cookie` con il token JWT.
 * - **400 Bad Request**: Parametri obbligatori mancanti (`microsoft_id` o `email`).
 * - **500 Internal Server Error**: Errore di connessione al DB o generazione token.
 */
module.exports = async function (context, req) {
  try {
    const { microsoft_id, email, name } = req.body;

    if (!microsoft_id || !email) {
      context.res = {
        status: 400,

        body: { error: "Dati mancanti per la creazione dell'utente" },
      };
      return;
    }

    const pool = await connectDB();

    const checkUser = await pool
      .request()
      .input("microsoft_id", sql.NVarChar, microsoft_id)
      .input("email", sql.NVarChar, email)
      .query(
        "SELECT * FROM users WHERE microsoft_id = @microsoft_id OR email = @email"
      );

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

    context.res = {
      status: 200,

      body: { message: "Login effettuato con successo" },
      cookies: [
        {
          name: "auth_token",
          value: token,
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "None",
          maxAge: 28800,
        },
      ],
    };
  } catch (err) {
    context.log.error("Errore SaveUser:", err);
    context.res = {
      status: 500,

      body: { error: `Errore: ${err.message}` },
    };
  }
};
