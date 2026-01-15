const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per ottenere il riepilogo delle spese degli ultimi 30 giorni, raggruppate per categoria.
 *
 * **Flusso di esecuzione:**
 * 1. **Autenticazione:** Estrae il token JWT dal cookie `auth_token` per ottenere il Microsoft ID (`oid`) dell'utente.
 * 2. **Analisi Temporale:** Filtra le spese registrate esclusivamente negli ultimi 30 giorni (`DATEADD(day, -30, GETDATE())`).
 * 3. **Aggregazione Dati:** Esegue una `INNER JOIN` con le categorie e calcola la somma totale (`SUM`) delle spese per ogni categoria trovata.
 *
 * @module Expenses
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Restituisce un array di oggetti `{ category_name, total }`, utile per la visualizzazione di grafici (es. grafico a torta).
 * - **401 Unauthorized**: Cookie mancante o token JWT scaduto/invalido.
 * - **500 Internal Server Error**: Errore durante l'esecuzione della query SQL.
 */
module.exports = async function (context, req) {
  try {
    const cookies = parseCookies(req);
    const token = cookies["auth_token"];

    if (!token) {
      context.log.warn("GetExpensesByCategory: Cookie mancante");
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

    const microsoft_id = decodedToken.oid;

    const pool = await connectDB();

    const result = await pool
      .request()
      .input("microsoft_id", sql.NVarChar, microsoft_id).query(`
      SELECT 
          c.name AS category_name,
          SUM(e.amount) AS total
      FROM expenses e
      INNER JOIN categories c ON e.category_id = c.id
      WHERE e.user_id = @microsoft_id
      AND e.date >= DATEADD(day, -30, GETDATE())
      GROUP BY c.name
    `);

    context.res = {
      status: 200,

      body: result.recordset,
    };
  } catch (err) {
    context.log.error("Errore GetExpensesByCategory:", err);
    context.res = {
      status: 500,

      body: { error: `Errore SQL: ${err.message}` },
    };
  }
};