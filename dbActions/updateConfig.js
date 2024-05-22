const db = require('./../core/db_connection')

async function updateConfig (id, externalId) {
  console.log('externalId: ' + externalId)
  return await db.query(`UPDATE config SET extId = "${externalId}" WHERE id = "${id}"`);
}

module.exports = updateConfig