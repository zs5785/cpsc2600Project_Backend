const mongoose = require('mongoose');

const ItemSellSchema = new mongoose.Schema(
    {
        itemID: {type: mongoose.Schema.ObjectId, required: true},
        sellerID: {type: mongoose.Schema.ObjectId, required: true},
        rarity: {type: String, required: true},
        price: {type: Number, required: true},
        listDate: {type: Date, required: true},
        mods: {type: Array }
    }
);

module.exports = mongoose.model('ItemSell', ItemSellSchema);