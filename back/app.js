const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const pool = require('./core/db_connection')

const app = express();
app.use(express.json());

// async function insertConfig(requestInterval, url) {
//   const query = 'INSERT INTO config (request_interval, url) VALUES (?, ?)';
//   const values = [requestInterval, url];
//   try {
//     const result = await new Promise((resolve, reject) => {
//       pool.query(query, values, (error, results) => {
//         if (error) {
//           reject(error);
//         } else {
//           resolve(results);
//         }
//       });
//     });
//     console.log('Inserted config:', result.insertId);
//   } catch (error) {
//     console.error('Error inserting config:', error);
//   }
// }

// Example usage:
// insertConfig(15, 'https://plan-m3hd.onrender.com/get-updates');


// async function makeRequest(url) {
//   console.log('request made: ' + url)
//   const startTime = Date.now();
//   try {
//     const response = await axios.get(url);
//     const endTime = Date.now();
//     const responseTime = endTime - startTime;

//     console.log(`Received data from ${url}:`, response.data);
//     console.log(`Response time: ${responseTime}ms`);

//     // Store the request in the database
//     const insertQuery = `
//       INSERT INTO requests (url, request_time, response_time, response_data, response_code)
//       VALUES (?, ?, ?, ?, ?)
//     `;
//     const values = [url, new Date(), responseTime, JSON.stringify(response.data), response.status];
//     await new Promise((resolve, reject) => {
//       pool.query(insertQuery, values, (error, results) => {
//         if (error) {
//           reject(error);
//         } else {
//           resolve(results);
//         }
//       });
//     });
//   } catch (error) {
//     console.error(`Error making request to ${url}: `, error.response.statusText);
//     // Store the error message in the database
//     const errorMessage = error.response.statusText;
//     const responseCode = error.response ? error.response.status : null;
//     const endTime = Date.now();
//     const responseTime = endTime - startTime;

//     // Store the error request in the database
//     const insertQuery = `
//       INSERT INTO requests (url, request_time, response_time, response_data, response_code)
//       VALUES (?, ?, ?, ?, ?)
//     `;
//     const errorValues = [url, new Date(), responseTime, errorMessage, responseCode];
//     await new Promise((resolve, reject) => {
//       pool.query(insertQuery, errorValues, (error, results) => {
//         if (error) {
//           reject(error);
//         } else {
//           resolve(results);
//         }
//       });
//     });
//   }
// }

let cronJobs = {}; // Object to hold cron job identifiers keyed by URL

async function stopCronJob(url) {
  if (cronJobs[url]) {
    cronJobs[url].stop();
    delete cronJobs[url];
  }
}

function getCronItemsCount() {
  return Object.keys(cronJobs).length
}

// function stopAllCronJobs() {
//   const stopPromises = Object.keys(cronJobs).map(url => {
//     const job = cronJobs[url];
//     return job.stop(); // Returns a Promise
//   });

//   return Promise.all(stopPromises).then(() => {
//     // All jobs have been stopped, so clear the cronJobs object
//     cronJobs = {};
//   });
// }

// app.get('/cron/stop-all', async (req, res) => {
//   stopAllCronJobs().then(() => {
//     console.log('All cron jobs have been stopped.');
//     res.json({ 'cron_jobs_count': getCronItemsCount() });
//   }).catch((error) => {
//     console.error('An error occurred while stopping cron jobs:', error);
//     res.status(500).json({ error: error });
//   });
// });

app.get('/cron/count', async (req, res) => {
  try {
    res.json({ 'cron_jobs_count': getCronItemsCount() });
  } catch (error) {
    console.error('An error occurred while stopping cron jobs:', error);
    res.status(500).json({ error: error });
  };
});

app.get('/cron/refresh', async (req, res) => {
  return stopAllCronJobs()
  .then(() => fetchConfigAndScheduleRequests())
  .then(() => res.json({ 'cron_jobs_count': getCronItemsCount() }))
  .catch(error => {
    res.status(500).json({ error: error });
  })
});

// async function fetchConfigAndScheduleRequests() {
//   // Fetch entries from the config table
//   const configQuery = 'SELECT * FROM config';
//   const [configRows] = await pool.query(configQuery);

//   // Process each config entry
//   for (const config of configRows) {
//     console.log(config)
//     const { id, request_interval, url } = config;

//     let cronPattern = `*/${request_interval} * * * *`;
//     console.log('cronPattern: ' + cronPattern)
//     const makeRequestOrSchedule = () => {
//       makeRequest(url).catch(console.error);
//     };

//     const cronJob = cron.schedule(cronPattern, makeRequestOrSchedule);
//     cronJobs[url] = cronJob;
//   }
// }

// fetchConfigAndScheduleRequests();

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});