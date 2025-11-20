const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema(
    {
        itemname: {type: String, required: true},
        type: {type: String, required: true},
        icon: {type: String, required: true},
        stats: {type: Array}
    }
);

module.exports = mongoose.model('Item', ItemSchema);