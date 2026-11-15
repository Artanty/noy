require('dotenv').config();
const axios = require('axios');

async function deleteExtJob(id) {
  try {
    return await axios.delete(`${process.env.CRON_JOB_URL}/${id}`, {
      headers: {
        Authorization: `Bearer ${process.env.CRON_JOB_TOKEN}`
      }
    });
  } catch (error) {
    console.error(`Error fetching job data for ID ${id}:`, error);
    throw error;
  }
}

module.exports = deleteExtJob