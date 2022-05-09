const express = require('express');
const server = express();
const { setRoutes } = require('./routes');

server.use(express.json());

setRoutes(server);

module.exports = { server };