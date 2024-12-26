const TABLES_CONFIG = require('./../core/db_tables')
const createTable = require('./../dbActions/createTable')
const checkTable = require('./../dbActions/checkTable')
const axios = require('axios');

class InitController {
  constructor() {
    this.getUpdatesApi = this.getUpdatesApi.bind(this);
  }
  async createTables (tableNames) {
    if (!tableNames || !Array.isArray(tableNames)) {
      throw new Error('Invalid table names provided. Expected an array of table names.');
    }
    try {
      await Promise.all(tableNames.map(async (tableName) => {
        try {
          await createTable(tableName);
        } catch (error) {
          console.error(`Error creating table ${tableName}: ${error.message}`);
        }
      }));
    } catch (error) {
      console.error('An error occurred while creating tables:', error.message);
    }
  }

  async createTable (tableName) {
    if (!Object.keys(TABLES_CONFIG).includes(tableName)) {
      throw new Error(`Can't create table: ${tableName}. Allowed tables: ${Object.keys(TABLES_CONFIG).join(', ')}`);
    }
    try { 
      await createTable(tableName)
      .then(result => {
        // console.log(`table ${tableName} created`)
        // console.log(result)
      })
    } catch (error) {
      console.error(error.message)
    }
  }

  /**
   * Делает проверку, есть ли подключение к БД и необходимые таблицы
   */
  async checkTable(tableName = Object.keys(TABLES_CONFIG)) {
    let count
    if (!tableName || (Array.isArray(tableName) && !tableName.length)) {
      throw new Error('Invalid table names provided.');
    }
    if(!Array.isArray(tableName)){
      tableName = [tableName]
    }
    count = tableName.length
    try { 
      return await checkTable(tableName)
      .then(result => {
        if (!Array.isArray(result)) { throw new Error('Wrong response format.')}
        if (result.length !== count) {
          throw new Error(`Tables that don't exist: ${tableName
            .filter(initialTable => !result
              .map(existingTable => existingTable.table_name.replace(`${process.env.PROJECT_ID.toUpperCase()}__`, ''))
              .includes(initialTable))
            .join(", ")}\nCreate them to continue.`)
        }
        console.log(`BAG service connected. Required tables exist: ${tableName.join(", ")}`)
        return true
      })
    } catch (error) {
      console.error(error.message)
    }
  }

  async sendRuntimeEventToStat(triggerIP) {
    try {
      const payload = {
        projectId: `${process.env.PROJECT_ID}@github`,
        namespace: process.env.NAMESPACE,
        stage: 'RUNTIME',
        eventData: JSON.stringify(
          {
            triggerIP: triggerIP,
            projectId: process.env.PROJECT_ID,
            slaveRepo: process.env.SLAVE_REPO,
            commit: process.env.COMMIT
          }
        )
      }
      await axios.post(`${process.env.STAT_URL}/add-event`, payload);
      console.log(`SENT TO @stat: ${process.env.PROJECT_ID}@github -> ${process.env.SLAVE_REPO} | ${process.env.COMMIT}`)
      return true
    } catch (error) {
      console.error('error in sendRuntimeEventToStat...');
      if (axios.isAxiosError(error)) {
        // Handle Axios-specific errors
        const axiosError = error; // as AxiosError
        console.error('Axios Error:', {
            message: axiosError.message,
            status: axiosError.response?.status,
            statusText: axiosError.response?.statusText,
            data: axiosError.response?.data,
        });
      } else {
          // Handle generic errors
          console.error('Unexpected Error:', error);
      }
      return false;
    }
  }

  // Function to check if the current minute is one of [0, 15, 30, 45]
  shouldRunStat(currentMinute) { // : boolean
    return [1, 15, 30, 45].includes(currentMinute);
  }

  // Global variable to track the last minute when sendRuntimeEventToStat was called
  lastExecutedMinute = null; // : number | null

  async getUpdatesApi (req, res) {
    const clientIP = req.ip;

    // Parse URL parameters
    const { stat } = req.query;

    let sendToStatResult = false;

    // Get the current minute
    const now = new Date();
    const currentMinute = now.getMinutes();

    // Check if stat=true is in the URL params
    if (stat === 'true') {
        sendToStatResult = await this.sendRuntimeEventToStat(clientIP);
    } else {
        // If stat is not true, check the current time and whether the function was already called this minute
        if (this.shouldRunStat(currentMinute) && lastExecutedMinute !== currentMinute) {
            lastExecutedMinute = currentMinute; // Update the last executed minute
            sendToStatResult = await this.sendRuntimeEventToStat(clientIP);
        }
    }

    res.json({
        trigger: clientIP,
        PORT: process.env.PORT,
        isSendToStat: sendToStatResult,
    });
  }
  
}

const instance = new InitController()

module.exports = instance