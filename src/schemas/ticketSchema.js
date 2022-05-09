const _ = require('ajv');
const ajv = new _();

const schema = {
	type: 'object',
	properties: {
		name: {type: 'string'},
		amount: {type: 'integer'},
		user_address: {type: 'string'}
	},
	required: ['name', 'amount', 'user_address'],
	additionalProperties: false
}

module.exports = ajv.compile(schema);