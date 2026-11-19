// Ligação MySQL (a mesma base de dados do bot e do servidor MTA)
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 8,
  charset: 'utf8mb4',
});

const q = async (sql, params = []) => (await pool.query(sql, params))[0];

module.exports = { pool, q };
