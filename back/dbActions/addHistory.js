const db = require('../core/db_connection')

/**
   * 
   * @param {app, url, request_time, response_time, response_data, response_code} data 
   * @returns 
   */
async function addHistory (data) {
  const { app, url, request_time, response_time, response_data, response_code } = data
  return await db.query(`INSERT INTO history (app, url, request_time, response_time, response_data, response_code) VALUES ("${app}", "${url}", "${request_time}", "${response_time}", "${response_data}", "${response_code}")`);
}

module.exports = addHistory