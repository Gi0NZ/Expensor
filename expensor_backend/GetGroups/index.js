const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per recuperare tutti i gruppi associati a un utente specifico.
 *
 * **Logica di Selezione (SQL):**
 * La funzione esegue una query per trovare tutti i gruppi pertinenti all'utente autenticato.
 * Utilizza una `LEFT JOIN` con la tabella membri e una clausola `WHERE` con logica **OR** per includere i gruppi dove l'utente è:
 * 1. **Creatore** (`created_by`).
 * 2. **Amministratore** (`admin`).
 * 3. **Membro Partecipante** (trovato tramite join su `group_members`).
 *
 * *Nota:* Viene utilizzato `DISTINCT` per evitare duplicati nel caso in cui un utente ricopra più ruoli nello stesso gruppo.
 *
 * @module GroupManagement
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Restituisce un array di oggetti (id, name, admin, created_by, created_at).
 * - **401 Unauthorized**: Cookie mancante o token JWT non valido.
 * - **500 Internal Server Error**: Errore durante l'esecuzione della query.
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

    const user_id = decodedToken.oid;

    const pool = await connectDB();

    const result = await pool
      .request()
      .input("current_user", sql.NVarChar, user_id).query(`
      SELECT DISTINCT 
          g.id, 
          g.name, 
          g.admin, 
          g.created_by, 
          g.created_at
      FROM groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      WHERE 
         g.created_by = @current_user
         OR 
         g.admin = @current_user
         OR 
         gm.user_id = @current_user
    `);

    context.res = {
      status: 200,

      body: result.recordset,
    };
  } catch (err) {
    context.log.error("GetGroups: errore 500 interno", err);
    context.res = {
      status: 500,

      body: { error: `Errore nel recupero dei gruppi: ${err.message}` },
    };
  }
};