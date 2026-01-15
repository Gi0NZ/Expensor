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
  user: process.env.DB_USER,     
  password: process.env.DB_PASSWORD, 
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
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let poolPromise;

const connectDB = async () => {
  if (poolPromise) {
    return poolPromise;
  }

 poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then((pool) => {
      console.log("✅ DB Connesso (Active Directory):", dbConfig.server);
      return pool;
    })
    .catch((err) => {
      console.error("Errore Connessione DB:", err.message);
      poolPromise = null; 
      throw err;
    });

  return poolPromise;
};

module.exports = { connectDB, sql };