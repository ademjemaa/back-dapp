const TicketsController = require('../controllers/ticketController');
const express = require('express'),
	router = express.Router();

// Get the table of tickets (name, amount).
router.get( '/', TicketsController.getAll );

module.exports = router;