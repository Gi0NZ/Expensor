const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per eliminare una spesa condivisa di un gruppo.
 *
 * **Sicurezza e Logica SQL (Atomic Check):**
 * Questa funzione implementa un pattern di sicurezza efficiente a livello di Database:
 * Esegue un comando `DELETE` condizionato da una clausola `WHERE EXISTS`.
 * La cancellazione viene effettuata **solo se** la sotto-query conferma che l'utente richiedente (`@reqId`) è l'attuale amministratore (`admin`) del gruppo specificato.
 * Se l'utente non è admin (o se la spesa/gruppo non esistono), nessuna riga viene toccata.
 *
 * @module GroupExpenses
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 * @param {Object} req.body - Il payload della richiesta.
 * @param {number} req.body.groupId - L'ID del gruppo a cui appartiene la spesa.
 * @param {number} req.body.expenseId - L'ID della spesa da eliminare.
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Eliminazione riuscita (la spesa esisteva e l'utente era admin).
 * - **400 Bad Request**: Parametri `groupId` o `expenseId` mancanti.
 * - **401 Unauthorized**: Cookie mancante o token non valido.
 * - **403 Forbidden**: Operazione fallita. Nessuna riga eliminata. Significa che la spesa non esiste OPPURE l'utente non ha i permessi di Admin.
 * - **500 Internal Server Error**: Errore di connessione o query SQL.
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

    const requestingUserId = decodedToken.oid;
    const { groupId, expenseId } = req.body;

    if (!groupId || !expenseId) {
      context.res = {
        status: 400,
        
        body: { error: "Campi obbligatori mancanti (groupId o expenseId)." },
      };
      return;
    }

    const pool = await connectDB();

    const result = await pool
      .request()
      .input("groupId", sql.Int, groupId)
      .input("id", sql.Int, expenseId)
      .input("reqId", sql.NVarChar(255), requestingUserId).query(`
        DELETE FROM group_expenses
        OUTPUT Deleted.id
        WHERE group_id = @groupId 
        AND id = @id
        AND EXISTS(
            SELECT 1 
            FROM groups
            WHERE id = @groupId AND admin = @reqId
        )
    `);

    if (result.recordset.length === 0) {
      context.res = {
        status: 403,
        
        body: {
          error:
            "Operazione fallita: Spesa non trovata oppure non hai i permessi di Admin.",
        },
      };
      return;
    }

    context.res = {
      status: 200,
      
      body: { message: "Spesa gruppo eliminata con successo!" },
    };
  } catch (err) {
    context.log.error("Errore RemoveExpenses:", err);

    context.res = {
      status: 500,
      
      body: { error: `Errore interno: ${err.message}` },
    };
  }
};