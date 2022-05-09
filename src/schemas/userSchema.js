const _ = require('ajv'),
	ajv = new _();

module.exports = ajv.compile({
	type: 'object',
	properties: {
		bank: {type: 'string'},
		vault: {type: 'string'},
	},
	required: ['bank', 'vault'],
	additionalProperties: false
});