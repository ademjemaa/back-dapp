const express = require('express');
const path = require('path');
const { HttpError } = require('../system/helpers/HttpError');
const apiRoutes = require('../system/routes');

setRoutes = (app) => {
	app.use((req, res, next) => {
		res.setHeader('Access-Control-Allow-Origin', 'https://staking.loftsclub.com');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
		res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
		res.setHeader('Access-Control-Allow-Credentials', true);

		next();
	})
	
	app.get('/', (req, res) => {
		res.send('Welcome to the APP');
	});

	app.use('/api', apiRoutes);

	app.use('/*', (req, res) => {
		const error = new Error('Requested path does not exist.');

        error.statusCode = 404;
        res.status(error.statusCode).json(new HttpError( error ));
	});
}

module.exports = { setRoutes };