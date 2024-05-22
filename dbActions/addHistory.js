const db = require('../core/db_connection')

/**
   * 
   * @param {url, request_time, response_time, response_data, response_code} data 
   * @returns 
   */
async function addHistory (data) {
  const { url, request_time, response_time, response_data, response_code } = data
  return await db.query(`INSERT INTO history (url, request_time, response_time, response_data, response_code) VALUES ("${url}", "${request_time}", "${response_time}", "${response_data}", "${response_code}")`);
}

module.exports = addHistory