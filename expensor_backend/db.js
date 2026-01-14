require("dotenv").config();
const sql = require("mssql");
const { DefaultAzureCredential } = require("@azure/identity");

function assertEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Variabile ${name} mancante`);
  return v;
}

const credential = new DefaultAzureCredential();

const dbConfig = {
  user: process.env.DB_USER,      // Ignorato se usi Active Directory, ma utile averlo
  password: process.env.DB_PASSWORD, // Ignorato se usi Active Directory
  server: assertEnv("DB_SERVER"),
  database: assertEnv("DB_DATABASE"),
  authentication: {
    type: "azure-active-directory-default",
    options: {
      credential,
    },
  },
  options: {
    encrypt: true,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
    enableArithAbort: true,
  },
  // Configurazione del Pool
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// Variabile globale per il pool
let poolPromise;

const connectDB = async () => {
  // 1. Se il pool è già stato creato, restituisci quella promessa
  if (poolPromise) {
    return poolPromise;
  }

  // 2. Crea un nuovo pool
  // Usiamo "new sql.ConnectionPool" invece di "sql.connect" per creare un'istanza isolata
  poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then((pool) => {
      console.log("✅ DB Connesso (Active Directory):", dbConfig.server);
      return pool;
    })
    .catch((err) => {
      console.error("❌ Errore Connessione DB:", err.message);
      poolPromise = null; // Resetta la variabile così al prossimo tentativo riprova
      throw err;
    });

  return poolPromise;
};

module.exports = { connectDB, sql };