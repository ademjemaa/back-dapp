const mongoose = require('mongoose');
const config = require('./config')();

class Connection {
    constructor() {
        const url = config.MONGO_URL;

        this.connect(url).then( () => {
            console.log('✔ Database Connected');
        }).catch((e) => {
            console.error('✘ MONGODB ERROR: ', e.message);
        });
    }

    async connect(url) {
        try {
            await mongoose.connect(url);
        }
		catch (e) {
            throw e;
        }
    }
}

module.exports = new Connection();