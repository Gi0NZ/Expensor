const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

module.exports = async function (context, req) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = req.headers["origin"];
  const corsHeaders = {
    "Access-Control-Allow-Origin":
      requestOrigin === allowedOrigin ? requestOrigin : "null",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

    const decodedToken = jwt.decode(token);
    if (!decodedToken || !decodedToken.oid) {
      context.res = {
        status: 401,
        headers: corsHeaders,
        body: { error: "Token non valido." },
      };
      return;
    }

    const requestingUserId = decodedToken.oid;
    const { expense_id, user_id, amount } = req.body;

    if (!expense_id || !user_id || amount === undefined) {
      context.res = {
        status: 400,
        headers: corsHeaders,
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
        headers: corsHeaders,
      };
      return;
    }

    const groupAdmin = checkAdmin.recordset[0].admin;

    if (groupAdmin !== requestingUserId) {
      context.res = {
        status: 403,
        headers: corsHeaders,
        body: { error: "Non autorizzato: Solo l'Admin può gestire le quote." },
      };
      return;
    }

    // 2. Controllo Logico: La quota non può diventare negativa
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

    // Se l'operazione porta il totale sotto zero
    if (currentAmount + amount < 0) {
      context.res = {
        status: 400,
        headers: corsHeaders,
        body: {
          error: `Impossibile sottrarre ${Math.abs(
            amount
          )}€. L'utente ha una quota attuale di soli ${currentAmount}€.`,
        },
      };
      return;
    }

    // 3. Esecuzione MERGE
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
      headers: corsHeaders,
    };
  } catch (err) {
    context.log.error("Errore AddExpenseSplit:", err);
    context.res = {
      status: 500,
      body: { error: err.message },
      headers: corsHeaders,
    };
  }
};
