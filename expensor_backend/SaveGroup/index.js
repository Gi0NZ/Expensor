const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per creare un nuovo gruppo di spesa.
 *
 * **Flusso di esecuzione:**
 * 1. **Autenticazione:** Identifica l'utente richiedente tramite il token JWT nel cookie `auth_token`.
 * 2. **Validazione Input:** Verifica la presenza del nome del gruppo nel corpo della richiesta.
 * 3. **Creazione e Assegnazione Ruoli:** Inserisce il nuovo gruppo nel database impostando l'utente richiedente sia come `created_by` che come `admin`.
 * 4. **Restituzione Dati (OUTPUT SQL):** Utilizza la clausola `OUTPUT INSERTED.*` per restituire immediatamente l'intero oggetto del gruppo appena creato, evitando una query di selezione successiva.
 *
 * @module GroupManagement
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 * @param {Object} req.body - Il payload della richiesta.
 * @param {string} req.body.name - Il nome scelto per il nuovo gruppo.
 *
 * @returns {Promise<void>} Imposta `context.res` con uno dei seguenti stati:
 * - **200 OK**: Restituisce l'oggetto completo del gruppo appena creato.
 * - **400 Bad Request**: Parametro `name` mancante nel body.
 * - **401 Unauthorized**: Cookie mancante o token non valido.
 * - **500 Internal Server Error**: Errore di connessione o esecuzione SQL.
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

    const microsoft_id = decodedToken.oid;
    const { name } = req.body;

    if (!name) {
      context.res = {
        status: 400,

        body: { error: "Nome del gruppo mancante." },
      };
      return;
    }

    const pool = await connectDB();

    const result = await pool
      .request()
      .input("name", sql.NVarChar(255), name)
      .input("admin", sql.NVarChar(255), microsoft_id).query(`
          INSERT INTO groups (name, created_by, created_at, admin)
          OUTPUT INSERTED.* VALUES (@name, @admin, GETDATE(), @admin);
      `);

    context.res = {
      status: 200,

      body: result.recordset[0],
    };
  } catch (err) {
    context.log.error("Error 500 su SaveGroup", err);
    context.res = {
      status: 500,

      body: { error: `Errore: ${err.message}` },
    };
  }
};
