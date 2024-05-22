const express = require('express');
require('dotenv').config();
const routes = require("./routes/routes");
const app = express();
app.use(express.json());
app.use("/", routes);

const InitController = require('./controllers/initController')

// InitController.createTable('config')
InitController.checkTable()

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
