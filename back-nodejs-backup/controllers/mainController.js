const axios = require('axios');
const ExternalController = require('./externalController')
const ConfigController = require('./configController') 
const InitController = require('./initController')
const HistoryController = require('./historyController')
const stringifyResponse = require('./../utils/stringifyResponse')
const wakeServer = require('./../utils/wakeServer')
const { readAxiosError, filterAxiosError} = require('./../utils/readAxiosError')
const addStatEvent = require('./../externalActions/addStatEvent')

class MainController {
  constructor() {
    this.refreshJobs = this.refreshJobs.bind(this);
  }
  
  async createExtJobAndUpdateConfigApi (req, res) {
    // console.log()
    try {
      const configId = req.params.id
      return await ConfigController.getConfig(configId)
      .then((configItem) => ExternalController.createExtJob(configItem))
      .then(configWithExtJobId => ConfigController.updateConfig(configWithExtJobId.id, configWithExtJobId.jobId))
      .then(result => {
        console.log(result)
        res.json(result)
      })
    } catch (error) {
      readAxiosError(error)
      
      res.status(500).json({ error: error.response.statusText });
      throw error;
    }
  }

  async createExtJobAndUpdateConfig (configItem) {
    try {
      return await ExternalController.createExtJob(configItem)
      .then(configWithExtJobId => ConfigController.updateConfig(configWithExtJobId.id, configWithExtJobId.jobId))
    } catch (error) {
      console.error(`Error while creating ${configItem.title}`, error);
      throw error;
    }
  }

  async createExtJobsAndUpdateConfigs (configItems) {
    for (let i = 0; i < configItems.length; i++) {
      try {
        await this.createExtJobAndUpdateConfig(configItems[i]);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`ERROR createExtJobs`, error);
      }
    }
  }
  
  /**
   * собираем джобы из внешнего сервиса
   * удаляем джобы из внешнего сервиса
   * берем конфиги из внутренней бд
   * пробегаемся по конфигам: 
   *  - создаем во внешнем сервисе,
   *  - получаем внешний id
   *  - сохраняем внешний id в соотв конфиге.
   * 
   * Применять когда изменения в конфиг были внесены напрямую в бд и нужно все сбросить и начать заново.
   */
  async refreshJobs (req, res) {  
    try {
      return InitController.checkTable('config')
        .then(() => ExternalController.getExtJobs()) 
        .then(ids => ExternalController.deleteExtJobs(ids))
        .then(() => ConfigController.getConfigs())
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
   * Same as makeRequest, but first wakes up a sleeping container
   * (Render / SnapDeploy free tier) and waits until it responds,
   * then performs the actual request.
   *
   * @param { https://noy-six.vercel.app/make-wake-request?target=https://plan-m3hd.onrender.com/get-updates&app=PLAN } req
   * Optional query params:
   *  - method: 'get' | 'post' | 'put' | 'delete' (default 'get')
   *  - body: JSON string for the request payload (default null)
   *  - maxWaitMs: total wake-up budget in ms (default 185000, ~3 min)
   */
  async makeWakeRequest (req, res) {
    const url = req.query.target;
    const app = req.query.app;
    const method = (req.query.method || 'get').toLowerCase();
    let body = null;
    if (req.query.body) {
      try {
        body = JSON.parse(req.query.body)
      } catch {
        return res.status(400).json({ error: 'Invalid JSON in "body" query param' });
      }
    }
    const maxWaitMs = Number(req.query.maxWaitMs) || 185000;

    if (!url) {
      return res.status(400).json({ error: 'Missing "target" query param' });
    }

    const requestTime = new Date();
    let wake = { awake: false, attempts: 0, elapsedMs: 0, strategy: 'not-started' };
    try {
      wake = await wakeServer(
        process.env.SNAPDEPLOY_WAKE === 'origin' ? new URL(url).origin : url,
        { maxWaitMs }
      );
      if (!wake.awake) {
        const message = `Server did not wake up within ${maxWaitMs}ms`
        console.error(message);
        if (process.env.SAVE_HISTORY) {
          await HistoryController.addHistory({
            app,
            url,
            request_time: new Date(requestTime).toISOString(),
            response_time: Date.now() - requestTime,
            response_data: message,
            response_code: 'wake-timeout'
          })
        }
        return res.status(504).json({ error: message, wake });
      }

      let response;
      switch (method) {
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

      console.log(`noy@s makeWakeRequest response from ${url}:`)
      console.log(`${JSON.stringify(response.data)}`)

      console.log(`✅ SUCCESS: ${method.toUpperCase()} ${url} → ${response.status}` +
        ` (woke in ${Math.round(wake.elapsedMs / 1000)}s, ${wake.attempts} check(s))`)

      if (process.env.SAVE_HISTORY) {
        console.warn('SAVE_HISTORY is on')
        await HistoryController.addHistory({
          app,
          url,
          request_time: new Date(requestTime).toISOString(),
          response_time: Date.now() - requestTime,
          response_data: response.data ? stringifyResponse(response.data) : 'no parsable data',
          response_code: response.status ? response.status : 'no parsable status'
        })
      }

      await addStatEvent(app)

      res.json({ request: 'completed', wake });
    } catch (error) {
      let status = 500
      let message
      if (axios.isAxiosError(error) && error.response) {
        // The wake succeeded but the real request got an HTTP error from the
        // target — log it concisely and pass the upstream status through.
        status = error.response.status
        message = `❌ FAILURE: target responded ${status} after wake: ${url}`
        console.error(message)
        console.error('Target response body:', typeof error.response.data === 'string' ? error.response.data.slice(0, 500) : JSON.stringify(error.response.data).slice(0, 500))
      } else {
        message = 'An error occurred while making the wake request. ' + error.message
        console.error(message)
        if (!axios.isAxiosError(error)) console.error(error)
      }

      const saveHistoryData = {
        app,
        url,
        request_time: new Date(requestTime).toISOString(),
        response_time: Date.now() - requestTime,
        response_data: stringifyResponse(error),
        response_code: axios.isAxiosError(error) && error.response ? String(error.response.status) : 'error'
      }
      if (process.env.SAVE_HISTORY) {
        console.warn('SAVE_HISTORY is on')
        await HistoryController.addHistory(saveHistoryData)
      }

      res.status(status).json({
        error: message,
        targetStatus: axios.isAxiosError(error) && error.response ? error.response.status : undefined,
        wake
      })
    }
  }

  /**
   *
   * @param { https://noy-six.vercel.app/make-request?target=https://plan-m3hd.onrender.com/get-updates&app=PLAN } req 
   * @param {{ request: 'completed' }} res 
   */
  async makeRequest (req, res) {
    const url = req.query.target;
    const app = req.query.app;
    const method = 'get'
    const body = null
    // Record the request time
    const requestTime = new Date();
    try {
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

      if (response.data) {
        console.log(`Url (req.query.target) for noy@s makeRequest: `)
        console.log(`${url}`)
        console.log(`noy@s makeRequest response: `)
        console.log(`${JSON.stringify(response.data)}`)
      }

      if (process.env.SAVE_HISTORY) {
        console.warn('SAVE_HISTORY is on')
        const saveHistoryData = { 
          app,
          url, 
          request_time: new Date(requestTime).toISOString(), 
          response_time: new Date() - requestTime, 
          response_data: response.data ? stringifyResponse(response.data) : 'no parsable data', 
          response_code: response.status ? response.status : 'no parsable status'
        }
        await HistoryController.addHistory(saveHistoryData)  
      }

      // const stat = req.query.stat
      // if (stat === 'true') {
         await addStatEvent(app)
      // }
      
      res.json({ request: 'completed' });
    } catch (error) {
      // console.log('error start')
      // console.log(error)
      // console.log('error end')
      const saveHistoryData = { 
        app,
        url, 
        request_time: new Date(requestTime).toISOString(), 
        response_time: new Date() - requestTime, 
        response_data: stringifyResponse(error), 
        response_code: 'error'
      }
      if (process.env.SAVE_HISTORY) {
        console.warn('SAVE_HISTORY is on')
        await HistoryController.addHistory(saveHistoryData)
      }
      console.error('An error occurred while making the request:', error);
      res.status(500).json({ error: 'An error occurred while making the request. ' + error });
    }
  }
}

const instance = new MainController()

module.exports = instance