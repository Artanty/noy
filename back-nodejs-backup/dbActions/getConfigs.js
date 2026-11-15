const db = require('../core/db_connection')

async function getConfigs () {
  return await db.query('SELECT * FROM config;');
}

module.exports = getConfigs