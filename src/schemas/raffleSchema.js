const _ = require('ajv');
const ajv = new _();

const schema = {
	type: 'object',
	properties: {
		bank: { type: 'string' },
		pubkey: { type: 'string' },
		nft: { type: 'string' },
		registerTime: { type: 'integer' },
		endTime: { type: 'integer' }
	},
	required: ['bank', 'nft', 'registerTime', 'endTime', 'pubkey'],
	additionalProperties: false
}

module.exports = ajv.compile(schema);