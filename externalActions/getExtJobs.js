require('dotenv').config();
const axios = require('axios');

async function getExtJobs() {
  try {
    return await axios.get('https://api.cron-job.org/jobs', {
      headers: {
        Authorization: `Bearer ${process.env.CRON_JOB_TOKEN}`
      }
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
  }
}

module.exports = getExtJobs