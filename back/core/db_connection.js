// const mysql = require('mysql2/promise');
// require('dotenv').config();

// const pool = mysql.createPool({
//   database: process.env.DB_DATABASE,
// 	user: process.env.DB_USERNAME,
// 	password: process.env.DB_PASSWORD,
// 	host: process.env.DB_HOST,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0
// });

// module.exports = pool;

const mysql = require('mysql');
require('dotenv').config();

// Create a MySQL connection pool
const pool = mysql.createPool({
  database: process.env.DB_DATABASE,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  connectionLimit: 10,
  queueLimit: 0
});

// Promisify the pool to use async/await
const db = {
  query: (sql, args) => {
    return new Promise((resolve, reject) => {
      pool.query(sql, args, (err, results) => {
        if (err) {
          return reject(err);
        }
        resolve(results);
      });
    });
  },
  close: () => {
    return new Promise((resolve, reject) => {
      pool.end(err => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }
};

module.exports = db;