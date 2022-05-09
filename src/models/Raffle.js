const mongoose = require('mongoose');
const { Schema } = require('mongoose');

class Raffle {
	initSchema() {
		const schema = new Schema({
			bank: { type: String, required: true },
			nft: { type: String, required: true },
			name: { type: String, required: true },
			image: { type: String, required: true },
			registerTime: { type: Number, required: true },
			endTime: { type: Number, required: true },
			status: { type: Number, required: true },
			winner: { type: String },
		}, { timestamps: true });

		try {
			mongoose.model('raffle', schema);
		} catch (err) {

		}
	}

	getInstance() {
		this.initSchema();
		return mongoose.model('raffle');
	}
}

module.exports = Raffle;