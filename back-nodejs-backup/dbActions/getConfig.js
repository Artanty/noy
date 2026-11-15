const db = require('./../core/db_connection')

async function getConfig (id) {
  return await db.query(`SELECT * FROM config WHERE id = "${id}"`);
}

module.exports = getConfig