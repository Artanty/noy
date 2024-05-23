const router = require("express").Router()
const ConfigController = require('./../controllers/configController') 
const ExternalController = require('./../controllers/externalController')
const MainController = require('./../controllers/mainController')
const InitController = require('./../controllers/initController')

router.get('/config/get', ConfigController.getConfigsApi)
router.post('/config/add', ConfigController.addConfigApi)
router.post('/config/delete-all', ConfigController.removeConfigsApi)


router.get('/jobs/get', ExternalController.getExtJobsApi)
router.post('/jobs/add', ExternalController.createExtJobApi)

router.get('/jobs/refresh', MainController.refreshJobs)
router.get('/make-request', MainController.makeRequest)
router.get('/jobs/refresh-one/:id', MainController.createExtJobAndUpdateConfigApi)

router.get('/get-updates', InitController.getUpdatesApi)

module.exports = router;