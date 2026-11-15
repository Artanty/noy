require('dotenv').config();
const axios = require('axios');
const { readAxiosError, filterAxiosError} = require('./../utils/readAxiosError')

async function createExtJob(data) {
  console.log(JSON.stringify(data))
  const headers = {
    Authorization: `Bearer ${process.env.CRON_JOB_TOKEN}`
  };
  try {
    return await axios.put(`${process.env.CRON_JOB_URL}`, data, { headers });
  } catch (error) {
    filterAxiosError(error, `Error with url ${data.url}`);
    // throw error;
  }
}

module.exports = createExtJob