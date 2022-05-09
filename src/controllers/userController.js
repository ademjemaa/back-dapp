const mongoose = require('mongoose');
const WalletController = require('./walletController');
const User = require('../models/User');
const Raffle = require('../models/Raffle');
const schema = require('../schemas/userSchema');
const { HttpError } = require('../../system/helpers/HttpError');
const { HttpResponse } = require('../../system/helpers/HttpResponse');
const autoBind = require('auto-bind');
const config = require('../../config.json');
const { PublicKey } = require('@solana/web3.js');
const { getNFTsByOwner } = require('../common/web3/NFTget');

class UserController {
	constructor() {
		this.wallet = new WalletController();
		this.model = new User().getInstance();
		this.raffleModel = new Raffle().getInstance();
		autoBind(this);
	}

	async register(req, res) {
		if (!schema(req.body)) {
			const response = new HttpError({ name: "ValidationError", errors: schema.errors });
			return res.status(response.statusCode).json(response);
		}

		const { bank } = req.body;

		try {
			const doc = await this.raffleModel.findOne({ "bank": bank });
			if (!doc || (doc && doc.status >= 1)) {
				const response = new HttpError({ name: "ValidationError", errors: 'The raffle does not exist or is closed.' });
				return res.status(response.statusCode).json(response);
			}

			const item = await this.model.create(req.body);
			const response = new HttpResponse(item);
			return res.status(response.statusCode).json(response);		
		} catch(err) {
			const response = new HttpError(err);
			return res.status(response.statusCode).json(response);
		}
	}

	async getMetadata(req, res) {
		const { id } = req.params;
		let response;

		try {
			const pubkey = new PublicKey(id);
			if (!PublicKey.isOnCurve(pubkey))
			{
				response = new HttpError('Your publickey is not on curve.');
			}
			else
			{
				const metadata = await getNFTsByOwner(pubkey, this.wallet.connection);
				response = new HttpResponse(metadata);
			}
			return res.status(response.statusCode).json(response);
		} catch(err) {
			response = new HttpError(err.message);
			return res.status(response.statusCode).json(response);
		}
	}
}

module.exports = new UserController();