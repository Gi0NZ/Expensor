const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per verificare l'appartenenza di un singolo utente a un gruppo specifico.
 *
 * **Flusso di esecuzione:**
 * 1. **Autenticazione:** Verifica la validità del token JWT (`auth_token`) estratto dai cookie.
 * 2. **Validazione Input:** Controlla la presenza dei parametri `group_id` e `microsoft_id` nella query string.
 * 3. **Ricerca Puntuale:** Esegue una query sulla tabella `group_members` cercando una corrispondenza esatta per la coppia gruppo/utente.
 *
 * **Nota sul comportamento:**
 * Se l'utente **non** fa parte del gruppo, la funzione restituisce comunque uno stato **200 OK** ma con un **body vuoto** (`[]`).
 * Questo permette al frontend di verificare l'appartenenza semplicemente controllando la lunghezza dell'array restituito.
 *
 * @module GroupMembers
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 * @param {string|number} req.query.group_id - L'ID del gruppo da interrogare.
 * @param {string} req.query.microsoft_id - L'ID dell'utente da cercare all'interno del gruppo.
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Restituisce un array contenente l'oggetto membro (se trovato) o un array vuoto (se non trovato).
 * - **400 Bad Request**: Parametri `microsoft_id` o `group_id` mancanti.
 * - **401 Unauthorized**: Cookie mancante o token non valido.
 * - **500 Internal Server Error**: Errore durante l'esecuzione della query SQL.
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

    const group_id = req.query.group_id;
    const microsoft_id = req.query.microsoft_id;

    if (!microsoft_id || !group_id) {
      context.res = {
        status: 400,

        body: { error: "Parametro microsoft_id o group_id mancante." },
      };
      return;
    }

    const pool = await connectDB();

    const result = await pool
      .request()
      .input("group_id", sql.Int, group_id)
      .input("microsoft_id", sql.NVarChar(255), microsoft_id).query(`
      SELECT group_id, user_id
      FROM group_members gm
      WHERE gm.group_id = @group_id AND gm.user_id = @microsoft_id
    `);

    context.res = {
      status: 200,

      body: result.recordset,
    };
  } catch (err) {
    context.log.error("GetSingleGroupMember: errore 500 interno", err);
    context.res = {
      status: 500,

      body: { error: `Errore nel recupero del singolo utente: ${err.message}` },
    };
  }
};
