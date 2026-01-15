const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per la gestione delle quote (split) di una spesa di gruppo.
 * Permette all'amministratore del gruppo di assegnare o modificare la quota di debito di un singolo utente per una specifica spesa.
 *
 * **Flusso di esecuzione:**
 * 1. **Autenticazione:** Estrae e valida il JWT dal cookie `auth_token`.
 * 2. **Verifica Permessi (Admin):** Controlla che l'utente richiedente sia l'amministratore del gruppo a cui appartiene la spesa.
 * 3. **Validazione Matematica:** Verifica che la sottrazione di un importo non porti la quota dell'utente in negativo (es. togliere 20€ se la quota attuale è 10€).
 * 4. **Persistenza (Upsert):** Utilizza `MERGE` su SQL Server:
 * - Se la quota esiste -> Aggiorna l'importo sommando/sottraendo il valore.
 * - Se non esiste -> Inserisce una nuova riga per l'utente.
 *
 * @module GroupExpenses
 * @param {Object} context - Contesto di esecuzione Azure.
 * @param {Object} req - Oggetto della richiesta HTTP.
 * @param {Object} req.body - Payload della richiesta.
 * @param {number} req.body.expense_id - ID univoco della spesa di gruppo.
 * @param {string} req.body.user_id - ID dell'utente a cui assegnare/modificare la quota.
 * @param {number} req.body.amount - L'importo da **aggiungere** o **sottrarre** (delta). Non è il totale finale, ma la variazione.
 *
 * @returns {Promise<void>} Imposta `context.res` con:
 * - **200 OK**: Quota aggiornata correttamente.
 * - **400 Bad Request**: Dati mancanti o tentativo di portare il debito in negativo.
 * - **401 Unauthorized**: Token mancante o invalido.
 * - **403 Forbidden**: L'utente richiedente non è l'Admin del gruppo.
 * - **404 Not Found**: Spesa non trovata.
 * - **500 Internal Server Error**: Errore database o server.
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

    const requestingUserId = decodedToken.oid;
    const { expense_id, user_id, amount } = req.body;

    if (!expense_id || !user_id || amount === undefined) {
      context.res = {
        status: 400,
        body: { error: "Dati mancanti." },
      };
      return;
    }

    const pool = await connectDB();

    // 1. Verifica Admin
    const checkAdmin = await pool.request().input("expId", sql.Int, expense_id)
      .query(`
            SELECT g.admin 
            FROM groups g
            JOIN group_expenses ge ON g.id = ge.group_id
            WHERE ge.id = @expId
        `);

    if (checkAdmin.recordset.length === 0) {
      context.res = {
        status: 404,
        body: { error: "Spesa non trovata." },
      };
      return;
    }

    const groupAdmin = checkAdmin.recordset[0].admin;

    if (groupAdmin !== requestingUserId) {
      context.res = {
        status: 403,
        body: { error: "Non autorizzato: Solo l'Admin può gestire le quote." },
      };
      return;
    }

    const currentShareCheck = await pool
      .request()
      .input("expId", sql.Int, expense_id)
      .input("userId", sql.NVarChar, user_id)
      .query(
        `SELECT share_amount FROM group_expense_shares WHERE expense_id = @expId AND user_id = @userId`
      );

    let currentAmount = 0;
    if (currentShareCheck.recordset.length > 0) {
      currentAmount = currentShareCheck.recordset[0].share_amount;
    }

    // Controllo per evitare debiti negativi
    if (currentAmount + amount < 0) {
      context.res = {
        status: 400,
        body: {
          error: `Impossibile sottrarre ${Math.abs(
            amount
          )}€. L'utente ha una quota attuale di soli ${currentAmount}€.`,
        },
      };
      return;
    }

    await pool
      .request()
      .input("expense_id", sql.Int, expense_id)
      .input("user_id", sql.NVarChar, user_id)
      .input("amount", sql.Decimal(10, 2), amount).query(`
            MERGE INTO group_expense_shares AS target
            USING (SELECT @expense_id AS expense_id, @user_id AS user_id) AS source
            ON (target.expense_id = source.expense_id AND target.user_id = source.user_id)
            WHEN MATCHED THEN
                UPDATE SET 
                    share_amount = share_amount + @amount,
                    last_updated = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT (expense_id, user_id, share_amount, paid, last_updated)
                VALUES (@expense_id, @user_id, @amount, 0, GETDATE());
        `);

    context.res = {
      status: 200,
      body: { message: "Quota aggiornata!" },
    };
  } catch (err) {
    context.log.error("Errore AddExpenseSplit:", err);
    context.res = {
      status: 500,
      body: { error: err.message },
    };
  }
};
