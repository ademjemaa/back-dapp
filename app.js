require( 'dotenv' ).config();
require('./config/database');
const config = require('./config/config')();

console.log('✔ Bootstrapping Application');
console.log(`✔ Mode: ${config.MODE}`);
console.log(`✔ Port: ${config.PORT}`);

const { server } = require('./config/server');

server.listen(config.PORT).on('error', (e) => {
	console.log('✘ Application failed to start');
	console.error('✘', e.message);
	process.exit(0);
}).on('listening', () => {
	console.log('✔ Application Started');
});

module.exports = { server };