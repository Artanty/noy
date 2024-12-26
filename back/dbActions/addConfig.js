const db = require('./../core/db_connection')

async function addConfig (config) {
  const { app, title, requestInterval, url, executor } = config
  return await db.query(`INSERT INTO config (app, title, request_interval, url, executor) 
  VALUES ("${app}", "${title}", "${requestInterval}", "${url}", "${executor}")`);
}

module.exports = addConfig