const addHistory = require('./../dbActions/addHistory')
const {filterAxiosError} = require('./../utils/readAxiosError')

class HistoryController {

  /**
   * 
   * @param {app, url, request_time, response_time, response_data, response_code} data 
   * @returns 
   */
  async addHistory (data) {
    try {
      return await addHistory(data).then((res)=>{
        console.log('add history res: ')
        console.log(res)
      })
    } catch (error) {
      console.log('add history error: ')
      console.error(error)
      filterAxiosError(error)
    }
  }
}

const instance = new HistoryController()

module.exports = instance