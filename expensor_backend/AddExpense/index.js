const sql = require("mssql");
const { connectDB } = require("../db");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");
const { sendBudgetAlert } = require("../utils/budgetMailSender");

/**
 * Azure Function triggered da HTTP per l'inserimento di una nuova spesa personale.
 *
 * **Flusso di esecuzione:**
 * 1. **Autenticazione:** Recupera il JWT dal cookie `auth_token` e decodifica le informazioni utente (OID, email, nome).
 * 2. **Validazione Input:** Verifica la presenza di `amount`, `date` e `category_id`.
 * 3. **Persistenza:** Inserisce il record nella tabella `expenses`.
 * 4. **Verifica Budget (Non bloccante):**
 * - Calcola il totale spese del mese corrente.
 * - Confronta il totale con il `monthly_limit` dell'utente.
 * - Se il limite è superato e non è stata inviata notifica nel mese corrente, invia email tramite `sendBudgetAlert`.
 * - Aggiorna il campo `last_email_sent_month` su DB per evitare spam.
 *
 * @module Expenses
 * @param {Object} context - Il contesto di esecuzione della Azure Function (usato per logging e response).
 * @param {Object} req - L'oggetto richiesta HTTP.
 * @param {Object} req.body - Il payload della richiesta.
 * @param {number} req.body.amount - L'importo della spesa.
 * @param {string} req.body.date - La data della spesa (es. YYYY-MM-DD).
 * @param {number} req.body.category_id - L'ID numerico della categoria.
 * @param {string} [req.body.description] - (Opzionale) Descrizione della spesa.
 * @param {string} [req.body.email] - (Opzionale) Email di fallback se non presente nel token.
 * @param {string} [req.body.name] - (Opzionale) Nome utente di fallback.
 *
 * @returns {Promise<void>} La funzione imposta `context.res` con:
 * - **201 Created**: Spesa inserita con successo.
 * - **400 Bad Request**: Parametri obbligatori mancanti.
 * - **401 Unauthorized**: Cookie mancante o Token non valido.
 * - **500 Internal Server Error**: Errore server generico.
 */
module.exports = async function (context, req) {
  try {
    const cookies = parseCookies(req);
    const token = cookies["auth_token"];

    if (!token) {
      context.log.warn("AddExpense: Cookie 'auth_token' mancante.");
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

    const currentUserId = decodedToken.oid;

    const userEmail = decodedToken.email;
    const userName = decodedToken.name || req.body.name || "Utente";

    const { amount, date, description, category_id } = req.body;

    if (!amount || !date || !category_id) {
      context.res = {
        status: 400,
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
      .input("user_id", sql.NVarChar(255), currentUserId).query(`
        INSERT INTO expenses (amount, date, description, category_id, user_id)
        VALUES (@amount, @date, @description, @category_id, @user_id)
      `);

    try {
      const checkBudget = await pool
        .request()
        .input("userId", sql.NVarChar, currentUserId).query(`
            SELECT 
                b.monthly_limit,
                b.last_email_sent_month, 
                (SELECT ISNULL(SUM(amount), 0) FROM expenses 
                 WHERE user_id = @userId 
                 AND MONTH(date) = MONTH(GETDATE()) 
                 AND YEAR(date) = YEAR(GETDATE())
                ) AS total_spent
            FROM user_budgets b
            WHERE b.user_id = @userId
        `);

      if (checkBudget.recordset.length > 0) {
        const { monthly_limit, total_spent, last_email_sent_month } =
          checkBudget.recordset[0];
        const now = new Date();
        let emailAlreadySentThisMonth = false;

        if (last_email_sent_month) {
          const sentDateObj = new Date(last_email_sent_month);
          const sentMonth = sentDateObj.getMonth();
          const sentYear = sentDateObj.getFullYear();

          if (sentMonth === now.getMonth() && sentYear === now.getFullYear()) {
            emailAlreadySentThisMonth = true;
          }
        }

        if (total_spent > monthly_limit && !emailAlreadySentThisMonth) {
          if (userEmail) {
            context.log(`Budget superato per ${userEmail}. Invio alert...`);

            console.log(
              "MAIL: ",
              userEmail,
              userName,
              total_spent,
              monthly_limit
            );
            const emailSent = await sendBudgetAlert(
              userEmail,
              userName,
              total_spent,
              monthly_limit
            );

            if (emailSent) {
              await pool
                .request()
                .input("userId", sql.NVarChar, currentUserId)
                .query(
                  "UPDATE user_budgets SET last_email_sent_month = GETDATE() WHERE user_id = @userId"
                );
              context.log("Flag email aggiornato nel DB.");
            }
          } else {
            context.log.warn(
              "Impossibile inviare alert budget: Email non trovata."
            );
          }
        }
      }
    } catch (budgetError) {
      context.log.error(
        "Errore non bloccante nella gestione Budget/Email:",
        budgetError
      );
    }

    context.res = {
      status: 201,
      body: { message: "Spesa aggiunta con successo!" },
    };
  } catch (err) {
    context.log.error("Errore critico AddExpense:", err);
    context.res = {
      status: 500,
      body: { error: `Errore Server: ${err.message}` },
    };
  }
};
