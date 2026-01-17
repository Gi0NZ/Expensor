require("dotenv").config();
const sql = require("mssql");

function assertEnv(name) {
  const v = process.env[name];
  if (!v) console.warn(`Variabile ${name} mancante o vuota`);
  return v;
}

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: assertEnv("DB_SERVER"),
  database: assertEnv("DB_DATABASE"),
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
      console.log("DB Connesso:", dbConfig.server);
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