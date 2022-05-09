const mongoose = require('mongoose');
const { Schema } = require('mongoose');

class User {
	initSchema() {
		const schema = new Schema({
			bank: { type: String, required: true },
			vault: { type: String, required: true },
		});

		try {
			mongoose.model('user', schema);	
		}
		catch (err) {

		}
	}

	getInstance() {
		this.initSchema();
		return mongoose.model('user');
	}
}

module.exports = User;