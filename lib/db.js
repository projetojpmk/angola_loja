// Ligação MySQL (a mesma base de dados do bot e do servidor MTA)
require('dotenv').config();
const mysql = require('mysql2/promise');

// Aceita os MESMOS nomes de variáveis do bot (MYSQL_PASS, MYSQL_DB) e os do próprio Railway (MYSQLHOST...)
const env = process.env;
const cfg = {
  host: env.MYSQL_HOST || env.MYSQLHOST,
  port: Number(env.MYSQL_PORT || env.MYSQLPORT) || 3306,
  user: env.MYSQL_USER || env.MYSQLUSER,
  password: env.MYSQL_PASS || env.MYSQL_PASSWORD || env.MYSQLPASSWORD,
  database: env.MYSQL_DB || env.MYSQL_DATABASE || env.MYSQLDATABASE,
};

const pool = mysql.createPool({
  ...cfg,
  connectTimeout: 15000,
  waitForConnections: true,
  connectionLimit: 8,
  charset: 'utf8mb4',
});

const q = async (sql, params = []) => (await pool.query(sql, params))[0];

module.exports = { pool, q };
