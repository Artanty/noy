require('dotenv').config();
const axios = require('axios');
const { readAxiosError, filterAxiosError} = require('./../utils/readAxiosError')

/**
 * @param { https://noy-six.vercel.app/make-request?target=https://plan-m3hd.onrender.com/get-updates&app=PLAN&stat=true } req  
 */
async function addStatEvent(projectId) {
  
  const payload = {
    projectId: `${projectId.toLowerCase()}@github`,
    namespace: 'web',
    stage: 'RUNTIME',
    // eventData: JSON.stringify(
    //   {
    //     slaveRepo: process.env.SLAVE_REPO,
    //     commit: process.env.COMMIT
    //   }
    // )
    eventData: 'todo in noy@'
  }
 
  try {
    return await axios.post(`${process.env.STAT_URL}/add-event`, payload);
  } catch (error) {
    filterAxiosError(error, `Error with url ${process.env.STAT_URL}/add-event`);
  }
}

module.exports = addStatEvent