const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");


/**
 * Azure Function per rimuovere una quota (split) di una spesa.
 * * **Flusso di esecuzione:**
 * 1. **Autenticazione:** Verifica la presenza e validità del cookie `auth_token`.
 * 2. **Verifica Ruolo:** Controlla che l'utente richiedente sia l'**Admin** del gruppo associato alla spesa.
 * 3. **Esecuzione:** Elimina la riga corrispondente dalla tabella `expense_splits`.
 * * @module ExpenseSplits
 * @param {Object} context - Contesto Azure Function.
 * @param {Object} req - Richiesta HTTP.
 * @param {string} req.body.expense_id - ID della spesa.
 * @param {string} req.body.user_id - ID dell'utente (Microsoft ID) a cui rimuovere la quota.
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

    const { expense_id, user_id } = req.body;

    if (!expense_id || !user_id) {
      context.res = {
        status: 400,
        body: { error: "Parametri mancanti (expense_id o user_id)" },
      };
      return;
    }

    const decoded = jwt.decode(token);
    const requesterId = decoded.oid;

    const pool = await connectDB();

    const checkAdmin = await pool
      .request()
      .input("expense_id", sql.Int, expense_id).query(`
        SELECT g.admin 
        FROM group_expenses e
        JOIN groups g ON e.group_id = g.id
        WHERE e.id = @expense_id
      `);

    if (checkAdmin.recordset.length === 0) {
      context.res = { status: 404, body: { error: "Spesa non trovata" } };
      return;
    }

    const groupAdmin = checkAdmin.recordset[0].admin;

    if (groupAdmin !== requesterId) {
      context.res = {
        status: 403,
        body: {
          error:
            "Accesso negato: Solo l'amministratore del gruppo può rimuovere le quote.",
        },
      };
      return;
    }

    await pool
      .request()
      .input("expense_id", sql.Int, expense_id)
      .input("user_id", sql.NVarChar, user_id)
      .query(
        "DELETE FROM group_expense_shares WHERE expense_id = @expense_id AND user_id = @user_id",
      );

    context.res = {
      status: 200,
      body: { message: "Quota rimossa con successo" },
    };
  } catch (err) {
    context.log.error("Errore RemoveExpenseSplit:", err);
    context.res = {
      status: 500,
      body: { error: `Errore interno: ${err.message}` },
    };
  }
};
