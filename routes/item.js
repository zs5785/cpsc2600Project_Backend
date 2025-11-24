const express = require('express');
const { ObjectId } = require("mongodb");
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const Session = require('../models/Session');
const ItemSell = require('../models/ItemSell');
const types = require('../lists/types');
const stats = require('../lists/stats');
const mods = require('../lists/mods');
const rarity = require('../lists/rarity');

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
        res.status(500).json({message: error.message});
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

router.get('/find/:id', async (req, res)=>{
    try{
        const postData = await ItemSell.findById(req.params.id);
        res.status(200).json(postData);
    }
    catch(err){
        res.status(400).json({message: err.message});
    }
});

router.patch('/edit/:id', async(req, res)=>{
    try{
        const data = req.body;

        const postID = req.params.id;

        const oldPost = await ItemSell.findById(postID);

        if (!oldPost)
            throw new Error('No Item Post found');

        const userData = await getUserData(data.token);

        if (!oldPost.sellerID.equals(userData._id))
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

router.delete('/delete/:data', async (req, res) =>{
    try{
        const data = JSON.parse(req.params.data);
        const oldPost = await ItemSell.findById(data.id);

        if (!oldPost)
            throw new Error('No Item Post found');

        const userData = await getUserData(data.token);

        console.log(oldPost.sellerID);
        console.log(userData._id);
        
        if (!oldPost.sellerID.equals(userData._id))
            throw new Error('Not Seller');

        await ItemSell.findByIdAndDelete(data.id);
        res.status(200).json({message: 'deleted'});
    }
    catch(error){
        res.status(400).json({message: error.message});
    }
});

router.get('/query', async (req, res)=>{
    try{
        const sortBy = req.query.sort;
        const sortOrder = req.query.order;

        let queryActions = [];

        if (req.query.ids){
            const idList = JSON.parse(req.query.ids).map((ele)=>new ObjectId(ele));
            queryActions.push({
                $match: {_id: {$in: idList}}
            });
        }

        queryActions.push({
            $lookup:{
                from: "users",
                localField: "sellerID",
                foreignField: "_id",
                as: "user",
                pipeline: [{$project:{password: 0, _id: 0, __v: 0}}]
            }
        });

        if (req.query.sellerName){
            queryActions.push({
                $match: {'user.username': req.query.sellerName}
            });
        }

        if (sortBy && sortOrder){
            queryActions.push({
                $sort: {[sortBy]: Number(sortOrder)}
            });
        }

        queryActions.push({
            $lookup:{
                from: "items",
                localField: "itemID",
                foreignField: "_id",
                as: "item",
                pipeline: [{$project:{_id: 0, __v: 0}}]
            }
        });

        const fieldContains = (arrayStr, field)=>{
            if (arrayStr){
                const listFilter = JSON.parse(arrayStr);

                if (listFilter.length > 0){
                    queryActions.push({
                        $match: {[field]: { $in: listFilter}}
                    });
                }
            }
        }

        fieldContains(req.query.items, 'item.itemname');
        fieldContains(req.query.types, 'item.type');
        fieldContains(req.query.rarities, 'rarity');

        function makeValueRangeComp(min, max){
            let cmp = {};
            if (min)
                cmp = {...cmp, $gte: Number(min)};
            if (max)
                cmp = {...cmp, $lte: Number(max)};
            return cmp;
        }

        const minPrice = req.query.minPrice;
        const maxPrice = req.query.maxPrice;

        if (minPrice || maxPrice){
            queryActions.push({
                $match: {price: makeValueRangeComp(minPrice, maxPrice)}
            });
        }

        function makeModCmp(modObj){
            let cmp = {
                name: modObj.name
            };

            if (modObj.val1 || modObj.val2){
                cmp = {
                    ...cmp,
                    val1: makeValueRangeComp(modObj.val1, modObj.val2)
                };
            }
            return cmp;
        }

        if (req.query.mods){
            const mods = JSON.parse(req.query.mods);
            if (mods.length > 0){
                mods.forEach((ele)=>{
                    queryActions.push({
                        $match: {mods: {$elemMatch: makeModCmp(ele)}}
                    });
                });
            }
        }

        const posts = await ItemSell.aggregate(queryActions);
        res.json(posts);
    }
    catch(error){
        res.status(500).json({message: error.message});
    }
});


module.exports = router;