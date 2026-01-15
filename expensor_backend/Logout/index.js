/**
 * Azure Function per gestire il logout locale dell'utente.
 * * **Funzionamento:**
 * 1. **Gestione CORS:** Configura le intestazioni per permettere richieste dal frontend autorizzato.
 * 2. **Preflight:** Gestisce le richieste `OPTIONS` rispondendo con 204.
 * 3. **Invalidazione Cookie:** Invia un header `Set-Cookie` che sovrascrive il cookie `auth_token`
 * impostando una data di scadenza nel passato (1970) e valore vuoto.
 * Questo forza il browser a eliminare il cookie, terminando la sessione locale senza disconnettere l'account Microsoft globale.
 * * @module Logout
 * @param {object} context - Contesto di esecuzione di Azure Function.
 * @param {object} req - Oggetto della richiesta HTTP.
 * @returns {Promise<void>} Imposta la risposta con status 200 e l'header per la cancellazione del cookie.
 */
const { parseCookies } = require("../utils/cookieHelper");

module.exports = async function (context, req) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  const requestOrigin = req.headers["origin"];
  
  const corsHeaders = {
    "Access-Control-Allow-Origin": requestOrigin === allowedOrigin ? requestOrigin : "null",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };


  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  const cookieString = "auth_token=; Path=/; HttpOnly; Secure; SameSite=None; Expires=Thu, 01 Jan 1970 00:00:00 GMT";

  context.res = {
    status: 200,
    headers: {
      ...corsHeaders,
      "Set-Cookie": cookieString 
    },
    body: { message: "Logout locale effettuato con successo" }
  };
};