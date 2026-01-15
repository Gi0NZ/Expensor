const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per recuperare la lista dei membri partecipanti a un gruppo specifico.
 *
 * **Flusso di esecuzione:**
 * 1. **Autenticazione:** Verifica la validità del token JWT (`auth_token`) estratto dai cookie.
 * 2. **Validazione Input:** Controlla la presenza del parametro `group_id` nella query string.
 * 3. **Recupero e Arricchimento Dati:** Esegue una `INNER JOIN` tra la tabella di collegamento `group_members` e la tabella anagrafica `users`.
 * Questo permette di restituire non solo gli ID, ma anche i nomi e le email degli utenti membri.
 *
 * @module GroupMembers
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 * @param {string|number} req.query.group_id - L'ID del gruppo di cui si vogliono conoscere i partecipanti.
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Restituisce un array di oggetti contenente: `{ user_id, user_name, user_email }`.
 * - **400 Bad Request**: Parametro `group_id` mancante.
 * - **401 Unauthorized**: Cookie mancante o token non valido.
 * - **500 Internal Server Error**: Errore durante l'esecuzione della query SQL.
 */
module.exports = async function (context, req) {
  try {
    const cookies = parseCookies(req);
    const token = cookies['auth_token'];

    if (!token) {
      context.res = {
        status: 401,
        
        body: { error: "Non autenticato." }
      };
      return;
    }

    const decodedToken = jwt.decode(token);
    if (!decodedToken || !decodedToken.oid) {
      context.res = {
        status: 401,
        
        body: { error: "Token non valido." }
      };
      return;
    }

    const group_id = req.query.group_id;
    if (!group_id) {
      context.res = {
        status: 400,
        body: { error: "Parametro group_id mancante" },
        
      };
      return;
    }

    const pool = await connectDB();

    const result = await pool.request().input("group_id", sql.Int, group_id)
      .query(`
      SELECT 
          gm.user_id,
          u.name AS user_name,
          u.email AS user_email
        FROM group_members gm
        INNER JOIN users u ON gm.user_id = u.microsoft_id
        WHERE gm.group_id = @group_id
    `);

    context.res = {
      status: 200,
      
      body: result.recordset,
    };
  } catch (err) {
    context.log.error("GetGroupMembers: errore 500 interno", err);
    context.res = {
      status: 500,
      
      body: { error: `Errore nel recupero dei membri: ${err.message}` },
    };
  }
};