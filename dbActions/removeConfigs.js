const db = require('./../core/db_connection')

async function removeConfigs () {
  return await db.query(`DELETE FROM config`);
}

module.exports = removeConfigs