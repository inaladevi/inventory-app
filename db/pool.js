
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,

  ...(process.env.DATABASE_URL
    ? {
        ssl: {
          rejectUnauthorized: false
        }
      }
    : {
        user: "inaladevi",
        host: "localhost",
        database: "inventory_db",
        port: 5432
      })
});

module.exports = pool;

