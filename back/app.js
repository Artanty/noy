const express = require('express');
require('dotenv').config();
const routes = require("./routes/routes");
const app = express();
// browser consumers (feat wake-up noy mode) call /make-wake-request cross-origin —
// without this header the response is blocked and the wake dies as "noy unreachable"
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});
app.use(express.json());
app.use("/", routes);

const InitController = require('./controllers/initController')

// InitController.createTable('config')
InitController.checkTable()

const PORT = process.env.PORT || 3211;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
