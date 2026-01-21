const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");



/**
 * Azure Function per gestire il logout locale dell'utente (chiusura sessione).
 *
 * **Meccanismo di Logout:**
 * La funzione adotta un approccio *stateless* per il logout: invece di invalidare il token lato server, istruisce il browser a cancellarlo.
 * Invia un header `Set-Cookie` con le seguenti caratteristiche:
 * 1. **Valore Vuoto:** Rimuove il contenuto del token.
 * 2. **Scadenza Passata:** Imposta `Expires` al 01 Gennaio 1970.
 * Questo forza il browser a eliminare immediatamente il cookie `auth_token`, terminando la sessione sull'applicazione corrente.
 *
 * @module User
 * @param {Object} context - Il contesto di esecuzione di Azure Function.
 * @param {Object} req - L'oggetto richiesta HTTP.
 *
 * @returns {Promise<void>} Imposta `context.res` con:
 * - **200 OK**: Restituisce un messaggio di successo e l'header `Set-Cookie` per la rimozione del token.
 */

module.exports = async function (context, req) {

  const cookieString = "auth_token=; Path=/; HttpOnly; Secure; SameSite=None; Expires=Thu, 01 Jan 1970 00:00:00 GMT";

  context.res = {
    status: 200,
    headers: {
      "Set-Cookie": cookieString 
    },
    body: { message: "Logout locale effettuato con successo" }
  };
};