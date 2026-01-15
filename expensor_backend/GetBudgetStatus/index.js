const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per recuperare lo stato del budget mensile dell'utente.
 *
 * **Funzionamento:**
 * 1. **Identificazione:** Estrae l'ID utente (`oid`) dal token JWT presente nei cookie.
 * 2. **Calcolo Spese:** Esegue una query che recupera il limite mensile impostato (`monthly_limit`) e calcola dinamicamente (tramite subquery) la somma di tutte le spese registrate nel mese e anno correnti.
 *
 * @module Budget
 * @param {Object} context - Contesto di esecuzione Azure.
 * @param {Object} req - Oggetto della richiesta HTTP.
 * @param {string} req.headers.cookie - Cookie contenente 'auth_token'.
 *
 * @returns {Promise<void>} Imposta `context.res` con:
 * - **200 OK**: Restituisce un oggetto JSON `{ monthly_limit, current_spent }`. Restituisce `null` nel body se l'utente non ha ancora configurato un budget.
 * - **500 Internal Server Error**: Errore generico (include il caso di token mancante in questa implementazione).
 */
module.exports = async function (context, req) {
  try {
    const cookies = parseCookies(req);
    const token = cookies["auth_token"];
    if (!token) throw new Error("No token");
    const userId = jwt.decode(token).oid;

    const pool = await connectDB();
    
    const result = await pool.request()
      .input("userId", sql.NVarChar, userId)
      .query(`
        SELECT 
            b.monthly_limit,
            (SELECT ISNULL(SUM(amount), 0) 
             FROM expenses 
             WHERE user_id = @userId 
             AND MONTH(date) = MONTH(GETDATE()) 
             AND YEAR(date) = YEAR(GETDATE())
            ) AS current_spent
        FROM user_budgets b
        WHERE b.user_id = @userId
      `);

    context.res = { 
        status: 200, 
        
        body: result.recordset.length > 0 ? result.recordset[0] : null 
    };
  } catch (err) {
    context.res = { status: 500,  body: { error: err.message } };
  }
};