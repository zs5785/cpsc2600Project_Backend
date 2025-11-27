const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema(
    {
        username: {type: String, required: true},
        token: {type: String, required: true},
        startDate: {type: Date, required: true}
    }
);

module.exports = mongoose.model('Session', SessionSchema);