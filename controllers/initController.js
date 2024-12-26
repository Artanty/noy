const TABLES_CONFIG = require('./../core/db_tables')
const createTable = require('./../dbActions/createTable')
const checkTable = require('./../dbActions/checkTable')

class InitController {
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
              .map(existingTable => existingTable.table_name.replace(`${process.env.APP_NAME}__`, ''))
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

  async getUpdatesApi (req, res) {
    res.json({ NOY__STATUS: 'working' })
  }
  
}

const instance = new InitController()

module.exports = instance