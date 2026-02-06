const sql = require("mssql/msnodesqlv8");

const server = process.env.DB_SERVER || "localhost\\SQLEXPRESS";
const database = process.env.DB_NAME || "iti_project";

const connectionString = process.env.DB_CONNECTION;

const driverFallbacks = [
  "ODBC Driver 17 for SQL Server",
  "ODBC Driver 18 for SQL Server",
  "SQL Server Native Client 11.0",
  "SQL Server"
];

const buildConnectionString = driverName => (
  `Driver={${driverName}};Server=${server};Database=${database};Trusted_Connection=Yes;TrustServerCertificate=Yes;`
);

const buildConfig = cs => ({
  driver: "msnodesqlv8",
  connectionString: cs
});

const tryConnect = async (connectionStringValue, label) => {
  const pool = await new sql.ConnectionPool(buildConfig(connectionStringValue)).connect();
  console.log(`✅ Connected to SQL Server (${label})`);
  return pool;
};

const connectWithFallback = async () => {
  if (connectionString) {
    try {
      return await tryConnect(connectionString, "connection string");
    } catch (err) {
      console.error("❌ Connection string failed. Trying driver fallbacks...", err);
    }
  }

  for (const driverName of driverFallbacks) {
    try {
      const cs = buildConnectionString(driverName);
      return await tryConnect(cs, `driver: ${driverName}`);
    } catch (err) {
      console.error(`❌ Driver failed (${driverName}).`, err);
    }
  }

  const defaultCs = buildConnectionString("ODBC Driver 17 for SQL Server");
  console.error("❌ Database Connection Failed (all attempts). Last tried:", defaultCs);
  throw new Error("Database connection failed. See logs for details.");
};

const poolPromise = connectWithFallback();

module.exports = {
  sql,
  poolPromise
};
