const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per configurare o aggiornare il budget mensile dell'utente.
 *
 * **Logica di Business (Upsert & Reset):**
 * 1. **Identificazione:** L'utente viene identificato tramite il token JWT nel cookie `auth_token`.
 * 2. **Gestione Dati (MERGE):** Utilizza lo statement SQL `MERGE` per gestire in modo atomico due scenari:
 * - **Inserimento:** Se l'utente non ha un budget, crea una nuova riga.
 * - **Aggiornamento:** Se il budget esiste, aggiorna il valore `monthly_limit`.
 * 3. **Reset Notifiche:** In caso di aggiornamento (UPDATE), imposta forzatamente `last_email_sent_month` a `NULL`.
 * *Scopo:* Se l'utente modifica il proprio budget (es. lo alza), il sistema deve dimenticare di aver già inviato un'email di allerta questo mese, permettendo l'invio di nuove notifiche se il nuovo limite viene superato.
 *
 * @module Budget
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 * @param {Object} req.body - Il payload della richiesta.
 * @param {number} req.body.monthly_limit - Il nuovo tetto massimo di spesa mensile desiderato.
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Budget salvato o aggiornato correttamente.
 * - **500 Internal Server Error**: Errore generico (include errore di autenticazione o errore SQL in questa implementazione).
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

    const decodedToken = jwt.decode(token);
    if (!decodedToken || !decodedToken.oid) {
      context.res = {
        status: 401,

        body: { error: "Token non valido." },
      };
      return;
    }

    const userId = decodedToken.oid;

    const { monthly_limit } = req.body;

    const pool = await connectDB();

    await pool
      .request()
      .input("userId", sql.NVarChar, userId)
      .input("limit", sql.Decimal(10, 2), monthly_limit).query(`
        MERGE user_budgets AS target
        USING (SELECT @userId AS user_id) AS source
        ON (target.user_id = source.user_id)
        WHEN MATCHED THEN
            UPDATE SET monthly_limit = @limit, last_email_sent_month = NULL
        WHEN NOT MATCHED THEN
            INSERT (user_id, monthly_limit) VALUES (@userId, @limit);
      `);

    context.res = {
      status: 200,

      body: { message: "Budget salvato!" },
    };
  } catch (err) {
    context.res = {
      status: 500,

      body: { error: err.message },
    };
  }
};
