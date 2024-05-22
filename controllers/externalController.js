const getExtJobs = require('./../externalActions/getExtJobs')
const deleteExtJob = require('./../externalActions/deleteExtJob')
const createExtJob = require('./../externalActions/createExtJob')
const countInterval = require('./../utils/countInterval')

class ExternalController {

  constructor() {
    this.createExtJobApi = this.createExtJobApi.bind(this);
  }

  async getExtJobsApi (req, res) {
    try {
      return await getExtJobs()
      .then(response => {
        if (!response.data || !response.data.jobs || !Array.isArray(response.data.jobs)) { 
          throw new Error('Wrong response format.')
        }
        res.json(response.data.jobs?.map(job => job.jobId) ?? [])
      })
    } catch (error) {
      console.error(error.message)
      res.status(404).send(error.message);
    }
  }

  async getExtJobs () {
    try {
      return await getExtJobs()
      .then(response => {
        if (!response.data || !response.data.jobs || !Array.isArray(response.data.jobs)) { 
          throw new Error('Wrong response format.')
        }
        return response.data.jobs?.map(job => job.jobId) ?? []
      })
    } catch (error) {
      console.error(error.message)
    }
  }

  async deleteExtJobs(ids) {
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

  /**
   * @param {string} config.url
   * @param {string} config.title
   * @param {number} config.request_interval
   * @returns number
   */
  async createExtJob (config) {
    
    const minutes = config.request_interval
      ? countInterval(config.request_interval)
      : [-1]
    
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
    
    try {
      return await createExtJob(data).then(response => {
        const externalId = response.data.jobId;
        return externalId;
      })
    } catch (error) {
      console.error(`Error creating job `, error);
      throw error;
    }
  }

  // async createExtJobs (configItems) {
  //   const promises = configItems.map(this.createExtJob);
  //   return await Promise.all(promises)    
  //     .catch(error => {
  //       console.error('Error creating one or more jobs:', error);
  //     });
  // }

  async createExtJobApi (req, res) {
    const defaultData = {
      request_interval: 10,
      url: 'https://plan-m3hd.onrender.com/get-updates',
      title: 'plan'
    }
    const createJobData = req.body?.url
      ? req.body
      : defaultData

    return this.createExtJob(createJobData)
    .then(result => res.json(result))
    .catch(error => {
      res.status(500).json({ error: error });
    })
  };
  
}

const instance = new ExternalController()

module.exports = instance