const axios = require('axios');
const ExternalController = require('./externalController')
const ConfigController = require('./configController') 
const InitController = require('./initController')
const HistoryController = require('./historyController')
const stringifyResponse = require('./../utils/stringifyResponse')

class MainController {
  constructor() {
    this.refreshJobs = this.refreshJobs.bind(this);
  }
  
  async createExtJobAndUpdateConfig (configItem) {
    try {
      return await ExternalController.createExtJob(configItem)
      .then(extJob => ConfigController.updateConfig(configItem.id, extJob.data?.jobId))
    } catch (error) {
      console.error(`Error while creating ${configItem.name}`, error);
      throw error;
    }
  }

  async createExtJobsAndUpdateConfigs (configItems) {
    const promises = configItems.map(this.createExtJobAndUpdateConfig);
    return await Promise.all(promises)    
      .catch(error => {
        console.error('Error creating one or more jobs:', error);
      });
  }
  
  async refreshJobs (req, res) {  
    try {
      return InitController.checkTable('config')
        .then(() => ExternalController.getExtJobs())
        .then(ids => ExternalController.deleteExtJobs(ids))
        .then(() => ConfigController.getConfig())
        .then((configs) => {
          return this.createExtJobsAndUpdateConfigs(configs)
        })
        .then(result => res.json(result))
        .catch(error => {
          console.log(error)
          res.status(500).json({ error: error });
        })
    } catch (error) {
      console.error(error.message)
      res.status(404).send(error.message);
    }   
  }

  /**
   * 
   * @param { https://noy-six.vercel.app/make-request?target=https://plan-m3hd.onrender.com/get-updates } req 
   * @param {{ request: 'completed' }} res 
   */
  async makeRequest (req, res) {
    console.log('makeRequest triggered')
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
          throw new Error('Unsupported HTTP method')
      }
      console.log(`Url ${url} response: ${JSON.stringify(response.data)}`)
      const saveHistoryData = { 
        url, 
        request_time: new Date(requestTime).toISOString(), 
        response_time: new Date() - requestTime, 
        response_data: stringifyResponse(response.data), 
        response_code: response.status
      }
      await HistoryController.addHistory(saveHistoryData)
  
      res.json({ request: 'completed' });
    } catch (error) {
      console.error('An error occurred while making the request:', error);
      res.status(500).json({ error: 'An error occurred while making the request. ' + error });
    }
  }
}

const instance = new MainController()

module.exports = instance