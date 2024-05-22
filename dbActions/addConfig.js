const db = require('./../core/db_connection')

async function addConfig (config) {
  const { title, requestInterval, url, executor } = config
  return await db.query(`INSERT INTO config (title, request_interval, url, executor) 
  VALUES ("${title}", "${requestInterval}", "${url}", "${executor}")`);
}

module.exports = addConfig