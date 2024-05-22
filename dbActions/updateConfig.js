const db = require('./../core/db_connection')

async function updateConfig (id, externalId) {
  return await db.query(`UPDATE config SET extId = "${externalId}" WHERE id = "${id}"`);
}

module.exports = updateConfig