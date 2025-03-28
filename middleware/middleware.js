const express = require('express');
const jwt = require('jsonwebtoken');
const dotEnv =require("dotenv")
dotEnv.config()


const middleware  = (req,res,next)=>{
    const token = req.header('x-token');
    if(!token){
        return res.status(401).send('Token Not Found');
        if (!process.env.jwtSecret) {
            console.error("jwtSecret is not defined in the environment variables.");
            process.exit(1);
        }

    }
    try{
       
        const decoded = jwt.verify(token,process.env.jwtSecret);
        req.user = decoded.user;
        console.log(req.user);
        next();
    }
    catch(err){
        res.status(401).send('Invalid Token');
    }

}

module.exports = middleware;