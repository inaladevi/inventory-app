
const { Pool } = require("pg");

const pool = new Pool({
  user: "inaladevi",
  host: "localhost",
  database: "inventory_db",
  port: 5432,
});

module.exports = pool;
