const { BlobServiceClient } = require("@azure/storage-blob");
const { connectDB } = require("../db");
const sql = require("mssql");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per rimuovere l'immagine del profilo di un utente.
 * * **Funzionamento:**
 * 1. **Autenticazione:** Verifica il cookie `auth_token` ed estrae l'ID utente (oid).
 * 2. **Recupero URL:** Interroga il database per ottenere l'URL attuale dell'immagine.
 * 3. **Eliminazione Immagine Blob:**
 * - Se esiste un URL, ne estrae il nome del file e lo elimina dal container `profile-images`.
 * - L'eliminazione è protetta da try-catch per non bloccare l'aggiornamento del DB in caso di file già assente.
 * 4. **Aggiornamento Database:** Imposta `profile_image_url` a `NULL` nella tabella `users`.
 * * @module User
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP.
 * @param {string} req.headers.cookie - Il cookie contenente il token di sessione.
 * * @returns {Promise<void>}
 * - **200 OK**: Foto rimossa (DB aggiornato e Blob eliminato se esistente).
 * - **204 No Content**: Risposta preflight CORS.
 * - **401 Unauthorized**: Cookie mancante o token invalido.
 * - **500 Internal Server Error**: Errore critico imprevisto.
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

    const microsoft_id = decodedToken.oid;

    const pool = await connectDB();

    const result = await pool
      .request()
      .input("uid", sql.NVarChar, microsoft_id)
      .query("SELECT profile_image_url FROM users WHERE microsoft_id = @uid");

    const currentUrl = result.recordset[0]?.profile_image_url;

    if (currentUrl) {
      try {
        const urlObj = new URL(currentUrl);
        const pathName = urlObj.pathname;
        const blobName = decodeURIComponent(pathName.split("/").pop());

        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        const blobServiceClient =
          BlobServiceClient.fromConnectionString(connectionString);
        const containerClient =
          blobServiceClient.getContainerClient("profile-images");
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        const exists = await blockBlobClient.exists();
        if (exists) {
          await blockBlobClient.delete();
          context.log(`Blob '${blobName}' eliminato con successo.`);
        }
      } catch (blobErr) {
        context.log.error("ERRORE CANCELLAZIONE BLOB:", blobErr.message);
      }
    }

    await pool
      .request()
      .input("uid", sql.NVarChar, microsoft_id)
      .query(
        "UPDATE users SET profile_image_url = NULL WHERE microsoft_id = @uid"
      );

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: { message: "Foto rimossa" },
    };
  } catch (err) {
    context.log.error("DeleteProfileImage: errore 500 interno", err);
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: err.message },
    };
  }
};
