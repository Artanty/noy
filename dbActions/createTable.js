const db = require('./../core/db_connection')
const TABLES_CONFIG = require('./../core/db_tables')
const removeNewline = require('./../utils/removeNewline')

async function createTable (tableName) {
  // db.endpoint = 'table-create'
  return await db.query(removeNewline(TABLES_CONFIG[tableName]));
}

module.exports = createTable