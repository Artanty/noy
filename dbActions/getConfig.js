const db = require('./../core/db_connection')

async function getConfig () {
  return await db.query('SELECT * FROM config;');
}

module.exports = getConfig