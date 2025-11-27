const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Session = require('../models/Session');
const uuid = require('uuid');
const bcrypt = require('bcrypt');

const saltRounts = 10;

async function makeSession(username, role){
    try{
        const userToken = uuid.v4();

        const updatedSession = await Session.updateOne(
            {username: username}, 
            {username: username, token: userToken, startDate: Date()},
            {upsert: true});

        if (updatedSession)
            return {username: username, token: userToken, role: role};
        else
            throw new Error("Cant update session");
    }
    catch (error){
        throw error;
    }
}

router.get('/:token', async (req, res)=>{
    const maxTokenSeconds = 1200;

    const token = req.params.token;

    const sessionData = await Session.aggregate([
        {
            $match:{token: token}
        },
        {
            $project:{
                username: 1,
                token: 1,
                endDate: {$dateDiff:{startDate: "$startDate", endDate: new Date(), unit: 'second'}}
            }
        },
        {
            $match: { endDate: {$lte: maxTokenSeconds}}
        }
    ]);
    if (sessionData && sessionData.length > 0){
        const userData = await User.findOne({username: sessionData[0].username}, {password: 0});
        if (userData)
            res.status(200).json({username: userData.username, role: userData.role, token: token});
        else
            res.status(400).json('Cant find user');
    }
    else
        res.status(400).json('Token invalid');

});

router.post('/login', async (req, res)=>{
    try{
        const input = req.body;
        const userData = await User.findOne({username: input.username});

        if (!userData)
            res.status(400).json({message: 'User doesnt exist'});
        else if (bcrypt.compareSync(input.password, userData.password)){
            const sessionData = await makeSession(userData.username, userData.role);
            res.status(200).json(sessionData);
        }
        else
            res.status(401).json({message: 'Wrong Password'});
    }
    catch (error){
        res.status(400).json({message: error.message});
    }
});

router.post('/signup', async (req, res)=>{
    try{
        if (await User.findOne({username: req.body.username})){
            res.status(400).json({message: 'User already existed'});
            return;
        }

        const hashedPassword = bcrypt.hashSync(req.body.password , saltRounts);
    
        const userData = new User({
            username: req.body.username, password: hashedPassword
        });

        const newUser = await userData.save();
        const sessionData = await makeSession(newUser.username, newUser.role);
        res.status(200).json(sessionData);
    }
    catch(error){
        res.status(400).json({message: error.message});
    }
});

module.exports = router;