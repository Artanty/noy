const getConfigs = require('../dbActions/getConfigs')
const getConfig = require('../dbActions/getConfig')
const addConfig = require('./../dbActions/addConfig')
const updateConfig = require('./../dbActions/updateConfig')
const removeConfigs = require('./../dbActions/removeConfigs')


class ConfigController {

  async removeConfigsApi (req, res) {
    try {
      await removeConfigs()
      .then(result => res.json(result))
      console.log('Configs deleted')
    } catch (error) {
      console.error(error.message)
      res.status(404).send(error.message);
    }
  }

  async getConfigsApi (req, res) {
    try {
      await getConfigs()
      .then(result => res.json(result))
    } catch (error) {
      console.error(error.message)
      res.status(404).send(error.message);
    }
  }

  async getConfigs () {
    try {
      return await getConfigs()
    } catch (error) {
      console.error(error.message)
    }
  }

  async addConfigApi (req, res) {
    const { app, title, requestInterval, url, executor } = req.body;
    try {
      const configData = {
        app, title, requestInterval, url, executor
      }
      return await addConfig(configData)
      .then(result => {
        console.log('Inserted config:', result.insertId);
        res.json(result)
      })
    } catch (error) {
      console.error('Error inserting config id:', error);
      res.status(404).send(error.message);
    }
  }

  async updateConfig (id, externalId) {
    console.log('updateConfig externalId: ' + externalId)
    try {
      return await updateConfig(id, externalId)
    } catch (error) {
      console.error('Error updating config:', error);
      res.status(404).send(error.message);
    }
  }

  async getConfig (id) {
    try {
      return await getConfig(id)
    } catch (error) {
      console.error('Error retrieving config:', error);
      res.status(404).send(error.message);
    }
  }
}
const instance = new ConfigController()

module.exports = instance