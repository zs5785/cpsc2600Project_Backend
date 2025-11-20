const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const Session = require('../models/Session');
const ItemSell = require('../models/ItemSell');
const types = require('../lists/types');
const stats = require('../lists/stats');
const mods = require('../lists/mods');
const rarity = require('../lists/rarity');
const { Schema, SchemaType } = require('mongoose');

async function getSession(token){
    try{
        const sessionData = await Session.findOne({token: token});
        if (!sessionData)
            throw new Error('Not valid session');
        else
            return sessionData;
    }
    catch(error){
        throw error;
    }
}

async function getUserData(token){
    try{
        const sessionData = await getSession(token);
        const userData = await User.findOne({username: sessionData.username}, {password: 0});
        if (!userData)
            throw new Error('Not valid User');
        else
            return userData;
    }
    catch(error){
        throw error;
    }
}

router.get('/', async (req, res)=>{
    try{
        const posts = await ItemSell.aggregate([
            {
                $sort: {listDate: -1}
            },
            {
                $lookup:{
                    from: "items",
                    localField: "itemID",
                    foreignField: "_id",
                    as: "item"
                }
            }
        ]);
        res.json(posts);
    }
    catch(error){
        res.status(500).json({message: error.message});
    }
});

router.get('/attr', (req, res)=>{
    res.status(200).json({rarity: rarity, types: types, stats: stats, mods: mods});
});

router.post('/new', async (req, res)=>{
    try{
        const data = req.body;

        const userData = await getUserData(data.token);

        if (userData.role !== 'admin')
            throw new Error('Not admin');

        const itemData = new Item({
            itemname: data.itemName,
            type: data.itemType,
            icon: data.itemIcon,
            stats: data.itemStats
        });

        const newItem = await itemData.save();
        res.status(200).json(newItem);
    }
    catch(error){
        res.status(400).json({message: error.message});
    }
});

router.get('/base', async (req, res)=>{
    try{
        const items = await Item.find();
        res.status(200).json(items);
    }
    catch(error){
        res.status(400).json({message: error.message});
    }
});

router.post('/sell', async (req, res)=>{
    try{
        const data = req.body;

        const userData = await getUserData(data.token);

        const postData = {
            itemID: data.itemID,
            sellerID: userData._id,
            rarity: data.rarity,
            price: data.price,
            listDate: Date(),
            mods: data.mods
        };
        const post = new ItemSell(postData);
        const newPost = await post.save();
        res.status(201).json({...newPost, message: 'Sucessful'});
    }
    catch(error){
        res.status(400).json({message: error.message});
    }
});

router.patch('/edit/:id', async(req, res)=>{
    try{
        const postID = req.params.id;
        const data = req.body;
        const oldPost = await ItemSell.findById(req.params.id);

        if (!oldPost)
            throw new Error('No Item Post found');

        const userData = await getUserData(data.token);

        if (oldPost.sellerID !== userData._id)
            throw new Error('Not Seller');

        const postData = {
            itemID: data.itemID,
            sellerID: userData._id,
            rarity: data.rarity,
            price: data.price,
            mods: data.mods
        };

        const updatedPost = await ItemSell.findByIdAndUpdate(postID, postData);

        res.status(200).json(updatedPost);
    }
    catch(error){
        res.status(400).json({message: error.message});
    }
});


module.exports = router;