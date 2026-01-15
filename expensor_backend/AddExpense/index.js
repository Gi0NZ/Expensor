const sql = require("mssql");
const { connectDB } = require("../db");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");
const { sendBudgetAlert } = require("../utils/budgetMailSender");

/**
 * Azure function per gestire l'aggiunta di una spesa personale.
 * * **Funzionalità:**
 * 1. Gestione CORS e Preflight.
 * 2. Autenticazione tramite Cookie HttpOnly (`auth_token`).
 * 3. Inserimento spesa nel DB `expenses`.
 * 4. **Check Budget:** Verifica se la spesa fa sforare il budget mensile.
 * 5. **Email Alert:** Se il budget è superato e non è già stata inviata mail questo mese, invia notifica con Resend.
 * * @module Expenses
 * @param {object} context - Contesto di esecuzione Azure.
 * @param {object} req - Oggetto della richiesta HTTP.
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

 
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: corsHeaders };
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
        body: { error: "Non autenticato." },
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

    const userEmail =
      decodedToken.email ||
      decodedToken.preferred_username ||
      decodedToken.unique_name ||
      req.body.email;
    const userName = decodedToken.name || req.body.name || "Utente";

    const { amount, date, description, category_id } = req.body;

    if (!amount || !date || !category_id) {
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
      headers: corsHeaders,
      body: { message: "Spesa aggiunta con successo!" },
    };

  } catch (err) {
    context.log.error("Errore critico AddExpense:", err);
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: `Errore Server: ${err.message}` },
    };
  }
};