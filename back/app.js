const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const db = require('./core/db_connection')

const app = express();
app.use(express.json());

async function getConfig () {
  try {
    const configs = await db.query('SELECT * FROM config;');
    console.log(configs);
    return configs
  } catch (error) {
    console.error('Error fetching users:', error);
  }
}


async function createExtJob (config) {
  let minutes = [-1]
  if (config.request_interval === 10) {
    minutes = [
      0,
      10,
      20,
      30,
      40,
      50
    ]
  }
  if (config.request_interval === 15) {
    minutes = [
      0,
      15,
      30,
      45
    ]
  }
  
  const targetUrl = config.executor === 'self' 
    ? `${process.env.NOY_URL}/make-request?target=${config.url}` 
    : config.url
  const data = {
    job: {
        title: config.title,
        url: targetUrl,
        enabled: "true",
        saveResponses: true,
        schedule: {
            timezone: "Europe/Berlin",
            expiresAt: 0,
            hours: [-1],
            mdays: [-1],
            minutes: minutes,
            months: [-1],
            wdays: [-1]
        }
    }
  };
  
  const headers = {
      Authorization: `Bearer ${process.env.CRON_JOB_TOKEN}`
  };

  try {
    const response = await axios.put(`https://api.cron-job.org/jobs`, data, { headers });
    const externalId = response.data.jobId;

    await updateConfig(config.id, externalId);

    return externalId;
  } catch (error) {
    console.error(`Error creating job `, error);
    throw error;
  }
}

async function createExtJobs (configItems) {
  const promises = configItems.map(createExtJob);
  return await Promise.all(promises)    
    .catch(error => {
      console.error('Error creating one or more jobs:', error);
    });
}

app.get('/jobs/refresh', async (req, res) => {
  return getExtJobs()
  .then(ids => deleteExtJobs(ids))
  .then(() => getConfig())
  .then((config) => createExtJobs(config))
  .then(result => res.json(result))
  .catch(error => {
    res.status(500).json({ error: error });
  })
});

async function updateConfig(id, externalId) {
  const query = 'UPDATE config SET extId = ? WHERE id = ?';
  try {
    const results = await db.query(query, [externalId, id]);
    return results;
  } catch (error) {
    console.error('Error updating config:', error);
    throw error;
  }
}

app.get('/jobs/createOne', async (req, res) => {
  const data = {
    request_interval: 10,
    url: 'https://plan-m3hd.onrender.com/get-updates',
    extId: null,
    title: 'plan'
  }
  return createExtJob(data)
  .then(result => res.json(result))
  .catch(error => {
    res.status(500).json({ error: error });
  })
});

https://noy-six.vercel.app?target=https://plan-m3hd.onrender.com/get-updates
app.get('/make-request', async (req, res) => {
  try {
    const url = req.query.target;
    const method = 'get'
    const body = null
    // Record the request time
    const requestTime = new Date();

    // Make the HTTP request using axios
    let response;
    switch (method.toLowerCase()) {
      case 'get':
        response = await axios.get(url, { data: body });
        break;
      case 'post':
        response = await axios.post(url, body);
        break;
      case 'put':
        response = await axios.put(url, body);
        break;
      case 'delete':
        response = await axios.delete(url, { data: body });
        break;
      default:
        return res.status(400).json({ error: 'Unsupported HTTP method' });
    }

    // Record the response time
    const responseTime = new Date() - requestTime;

    // Save the request data to the MySQL database
    const insertQuery = 'INSERT INTO requests (url, request_time, response_time, response_data, response_code) VALUES (?, ?, ?, ?, ?)';
    const insertValues = [url, requestTime, responseTime, JSON.stringify(response.data), response.status];
    await db.query(insertQuery, insertValues);

    // Send the response from the HTTP request back to the client
    res.json(response.data);
  } catch (error) {
    // Handle any errors that occurred during the HTTP request or database insertion
    console.error('Error making request or inserting data:', error);
    res.status(500).json({ error: 'An error occurred while making the request or saving data' });
  }
});

async function deleteExtJob(id) {
  try {
    return await axios.delete(`https://api.cron-job.org/jobs/${id}`, {
      headers: {
        Authorization: `Bearer ${process.env.CRON_JOB_TOKEN}`
      }
    });
  } catch (error) {
    console.error(`Error fetching job data for ID ${id}:`, error);
    throw error;
  }
}

async function deleteExtJobs(ids) {
  console.log(ids)
  try {
    if (!Array.isArray(ids)) { console.error('jobs ids is not array'); throw new Error('jobs ids is not array') }
    if (!ids.length) { return { result: 'no ids to delete' } }
    const promises = ids.map(deleteExtJob);

    await Promise.all(promises);

    return { result: promises.map(response => response.data)}
  } catch (error) {
    console.error('An error occurred while deleting cron jobs:', error);
  }
}

app.get('/jobs/get', async (req, res) => {
  try {
    const jobs = await getExtJobs()
    res.json({ 'jobs': jobs });
  } catch (error) {
    console.error('An error occurred while stopping cron jobs:', error);
    res.status(500).json({ error: error });
  };
});


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

/**
 * 
 * @returns string[]
 */
async function getExtJobs() {
  try {
    const response = await axios.get('https://api.cron-job.org/jobs', {
      headers: {
        Authorization: `Bearer ${process.env.CRON_JOB_TOKEN}`
      }
    });
    const jobs = response.data?.jobs;
    return jobs?.map(job => job.jobId) ?? []
  } catch (error) {
    console.error('Error fetching jobs:', error);
  }
}

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// return createExtJob(data)
//   .then(result => res.json(result))
//   .catch(error => {
//     res.status(500).json({ error: error });
//   })
// });