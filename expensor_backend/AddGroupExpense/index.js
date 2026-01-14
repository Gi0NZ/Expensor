const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per registrare una nuova spesa condivisa all'interno di un gruppo.
 * * **Logica di Sicurezza (RBAC):**
 * Prima di inserire la spesa, verifica che l'utente richiedente (identificato tramite Cookie) sia l'**ADMIN** del gruppo specificato.
 * * @module GroupExpenses
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP.
 * @param {string} req.headers.cookie - Il cookie contenente il token di sessione.
 * @param {object} req.body - Il corpo della richiesta.
 * @param {number} req.body.group_id - L'ID del gruppo.
 * @param {string} req.body.description - Descrizione della spesa.
 * @param {number} req.body.amount - Importo.
 * * @returns {Promise<void>}
 * - **201 Created**: Spesa aggiunta.
 * - **400 Bad Request**: Parametri mancanti.
 * - **401 Unauthorized**: Cookie mancante o token invalido.
 * - **403 Forbidden**: L'utente non è l'admin del gruppo.
 * - **404 Not Found**: Il gruppo non esiste.
 */
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
    const { group_id, description, amount } = req.body;

    if (!group_id || !description || !amount) {
      context.res = {
        status: 400,
        headers: corsHeaders,
        body: {
          error: "Campi obbligatori mancanti.",
        },
      };
      return;
    }

    const pool = await connectDB();

    const groupCheck = await pool
      .request()
      .input("gid", sql.Int, group_id)
      .query("SELECT admin FROM groups WHERE id = @gid");

    if (groupCheck.recordset.length === 0) {
      context.res = {
        status: 404,
        headers: corsHeaders,
        body: { error: "Gruppo non trovato." },
      };
      return;
    }

    const groupAdmin = groupCheck.recordset[0].admin;

    if (groupAdmin !== requestingUserId) {
      context.res = {
        status: 403,
        headers: corsHeaders,
        body: {
          error:
            "Non autorizzato: Solo l'Admin del gruppo può aggiungere spese.",
        },
      };
      return;
    }

    await pool
      .request()
      .input("group_id", sql.Int, group_id)
      .input("description", sql.NVarChar(255), description)
      .input("amount", sql.Decimal(10, 2), amount)
      .input("paid_by", sql.NVarChar(255), requestingUserId).query(`
        INSERT INTO group_expenses (group_id, description, amount, paid_by, created_at)
        VALUES (@group_id, @description, @amount, @paid_by, GETDATE())
      `);

    context.res = {
      status: 201,
      headers: corsHeaders,
      body: { message: "Spesa aggiunta con successo!" },
    };
  } catch (err) {
    context.log.error("Errore AddGroupExpense:", err);
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: `Errore SQL: ${err.message}` },
    };
  }
};
