const TABLES_CONFIG = {
  history: `CREATE TABLE history (
    id SERIAL PRIMARY KEY, 
    url VARCHAR(255), 
    app VARCHAR(255), 
    request_time TIMESTAMP, 
    response_time INTEGER, 
    response_data TEXT, 
    response_code INTEGER);`,

  config: `CREATE TABLE config (
    id SERIAL PRIMARY KEY, 
    request_interval INTEGER, 
    url TEXT, 
    extId TEXT, 
    title TEXT, 
    app VARCHAR(255),
    executor TEXT);`
}

module.exports = TABLES_CONFIG