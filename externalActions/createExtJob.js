require('dotenv').config();
const axios = require('axios');

async function createExtJob(data) {
  console.log(JSON.stringify(data))
  const headers = {
    Authorization: `Bearer ${process.env.CRON_JOB_TOKEN}`
  };
  try {
    return await axios.put(`https://api.cron-job.org/jobs`, data, { headers });
  } catch (error) {
    console.error(`Error creating job with url ${data.url}:`, error);
    throw error;
  }
}

module.exports = createExtJob