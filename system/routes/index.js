const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const pluralize = require( 'pluralize' );
const packageJson = require('../../package.json'),
	routesPath = path.resolve(`${__dirname}/../../src/routes`),
	PATHS = fs.readdirSync(routesPath),
	moduleMapper = [];

console.log('✔ Mapping routes');
PATHS.forEach((module) => {
	if (module !== 'index.js') {
		const name = module.split('.')[0];
		const route = '/' + pluralize.plural(name);

		router.use(`${route}`, require(path.resolve(routesPath, module)));
		moduleMapper.push({
			'Module': name,
			'Route': route
		});
	}
});

console.table(moduleMapper);

router.get('/', (req, res) => {
	res.json({ 'status': true, 'message': `Welcome to ${packageJson.name} V ${packageJson.version}`});
});

router.use('*', (req, res, next) => {
	next();
});

router.use((err, req, res, next) => {
	if (process.env.NODE_ENV !== 'production') {
		console.error(req.method, req.url, err.statusCode, err.message);
	}
	next();
});

module.exports = router;