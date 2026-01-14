const { BlobServiceClient } = require("@azure/storage-blob");
const { connectDB } = require("../db");
const sql = require("mssql");
const multipart = require("parse-multipart-data");
const { parseCookies } = require("../utils/cookieHelper");
const jwt = require("jsonwebtoken");

/**
 * Azure Function per l'upload e l'aggiornamento dell'immagine del profilo utente.
 * * **Flusso di Esecuzione:**
 * 1. **Autenticazione:** Verifica il cookie `auth_token` ed estrae l'ID utente.
 * 2. **Parsing:** Decodifica il body `multipart/form-data` per estrarre il file.
 * 3. **Pulizia:** Controlla nel DB se l'utente ha già una foto ed elimina il blob precedente.
 * 4. **Upload:** Carica la nuova immagine nel container `profile-images`.
 * 5. **Update DB:** Aggiorna l'URL dell'immagine nella tabella `users`.
 * * **Dipendenze:** Richiede `@azure/storage-blob` e `parse-multipart-data`.
 * * @module UserProfile
 * @param {object} context - Il contesto di esecuzione di Azure Function.
 * @param {object} req - L'oggetto richiesta HTTP (multipart/form-data).
 * @param {string} req.headers.cookie - Il cookie contenente il token di sessione.
 * * @returns {Promise<void>}
 * - **200 OK**: Immagine aggiornata con successo. Restituisce il nuovo URL.
 * - **204 No Content**: Preflight CORS.
 * - **400 Bad Request**: File mancante o body vuoto.
 * - **401 Unauthorized**: Cookie mancante o token invalido.
 * - **500 Internal Server Error**: Errore upload o database.
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
    const token = cookies['auth_token'];

    if (!token) {
      context.res = {
        status: 401,
        headers: corsHeaders,
        body: { error: "Non autenticato." }
      };
      return;
    }

    const decodedToken = jwt.decode(token);
    if (!decodedToken || !decodedToken.oid) {
      context.res = {
        status: 401,
        headers: corsHeaders,
        body: { error: "Token non valido." }
      };
      return;
    }

    const microsoft_id = decodedToken.oid;

    if (!req.body) throw new Error("Body vuoto");

    const bodyBuffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body);
    const boundary = multipart.getBoundary(req.headers["content-type"]);
    const parts = multipart.parse(bodyBuffer, boundary);

    const file = parts.find((p) => p.filename);

    if (!file) throw new Error("File mancante");

    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString);
    const containerClient =
      blobServiceClient.getContainerClient("profile-images");
    await containerClient.createIfNotExists({ access: "blob" });

    const pool = await connectDB();

    const userRes = await pool
      .request()
      .input("uid", sql.NVarChar, microsoft_id)
      .query("SELECT profile_image_url FROM users WHERE microsoft_id = @uid");

    const currentUrl = userRes.recordset[0]?.profile_image_url;

    if (currentUrl) {
      try {
        const oldBlobName = currentUrl.split("/").pop();

        if (oldBlobName) {
          const oldBlobClient = containerClient.getBlockBlobClient(oldBlobName);
          await oldBlobClient.deleteIfExists();
        }
      } catch (cleanupErr) {
        context.log.warn(
          "Warning pulizia vecchia immagine:",
          cleanupErr.message
        );
      }
    }

    const newFilename = `${microsoft_id}_${Date.now()}_${file.filename}`;
    const blockBlobClient = containerClient.getBlockBlobClient(newFilename);

    await blockBlobClient.upload(file.data, file.data.length, {
      blobHTTPHeaders: { blobContentType: file.type },
    });

    const newImageUrl = blockBlobClient.url;

    await pool
      .request()
      .input("url", sql.NVarChar, newImageUrl)
      .input("uid", sql.NVarChar, microsoft_id)
      .query(
        "UPDATE users SET profile_image_url = @url WHERE microsoft_id = @uid"
      );

    context.res = {
      status: 200,
      headers: corsHeaders,
      body: { message: "Immagine aggiornata con successo", url: newImageUrl },
    };
  } catch (err) {
    context.log.error("Errore upload immagine profilo:", err);
    context.res = {
      status: 500,
      headers: corsHeaders,
      body: { error: "Errore durante l'aggiornamento: " + err.message },
    };
  }
};