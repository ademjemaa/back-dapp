const { HttpError } = require('../../system/helpers/HttpError');
const { HttpResponse } = require('../../system/helpers/HttpResponse');
const config = require('../../config.json');

class TicketController {
	constructor() {}

	async getAll(req, res) {
		try {
			const response = new HttpResponse(config.tickets);
			return res.status(response.statusCode).json(response);
		}
		catch(err) {
			const response = new HttpError(err);
			return res.status(response.statusCode).json(response);
		}
	}
}

module.exports = new TicketController();