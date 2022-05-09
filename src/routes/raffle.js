const RaffleController = require('../controllers/raffleController');
const express = require('express'),
	router = express.Router();

// Create new raffle
router.post( '/', RaffleController.create );

// Check if user is admin
router.get( '/admin/:id', RaffleController.isAdmin );

// Get status of the raffle
router.get( '/allow/:id', RaffleController.allowToRegister );

// Get raffle
router.get( '/raffle/:id', RaffleController.get );

// Get all raffles
router.get( '/', RaffleController.getAll );

// Get all raffles with gemcount of the user
router.get( '/:user', RaffleController.getAllWithGemCount );

module.exports = router;