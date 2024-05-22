const addHistory = require('./../dbActions/addHistory')

class HistoryController {

  /**
   * 
   * @param {url, request_time, response_time, response_data, response_code} data 
   * @returns 
   */
  async addHistory (data) {
    try {
      return await addHistory(data).then(()=>console.log('history saved'))
    } catch (error) {
      console.error(error)
      console.error(error.message)
    }
  }
}

const instance = new HistoryController()

module.exports = instance