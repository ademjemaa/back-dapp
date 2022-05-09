const UserController = require('../controllers/userController');
const express = require('express'),
	router = express.Router();

// Register new user in raffle
router.post( '/', UserController.register );

// Get metadata of public key
router.get( '/metadata/:id', UserController.getMetadata );

module.exports = router;