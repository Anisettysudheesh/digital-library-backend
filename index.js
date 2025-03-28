const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
const UserDetails = require("./mongo");
const dotEnv = require('dotenv');
const bcrypt = require('bcrypt');
dotEnv.config();
const jwt = require('jsonwebtoken');
app.use(express.json());
const middleware = require('./middleware/middleware');
if (!process.env.jwtSecret || !process.env.AdminEmail || !process.env.AdminPassword) {
    console.error("Environment variables are missing.");
    process.exit(1);
}

app.get("/", (req, res) => {
    res.send('Hello World');
});

app.post("/UserReg", async (req, res) => {
    const { username,  password } = req.body;
    const exist = await UserDetails.findOne({ username });

    try {
        if (exist) {
            return res.status(400).send('User already exist');
        }
       
        const hashpassword = await bcrypt.hash(password, 10);
        const user = new UserDetails({
            username,
            password: hashpassword,
        });

        const response = await user.save();
        res.status(200).send('User Registered');
    } catch (err) {
        res.status(500).send('Server Error');
    }
});


app.post("/UserLogin", async (req, res) => {
    const { username, password } = req.body;
    const exist = await UserDetails.findOne({ username });
    try {
        if (!exist) {
            return res.status(400).send('User does not exist');
        }
        const validpassword = await bcrypt.compare(password, exist.password);

        if (!validpassword) {
            return res.status(400).send('Invalid Password');
        }

        const payload = {
            user: {
                id: exist._id,
                username: exist.username
            }
        };

        jwt.sign(payload, process.env.jwtSecret, { expiresIn: "1h" },
            (err, token) => {
                if (err) throw err;
                res.status(200).json({ "token": token });
            });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

app.get("/UserDashboard", middleware, async (req, res) => {
    try {
        const user = await UserDetails.findById(req.user.id);
        res.json(user);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});
app.post("/changepass",middleware, async (req,res)=>{
    const {oldpass,newpass}=req.body
    const username =req.user.username

    try{
        if(oldpass === newpass){
            return res.status(400).send('New Password cannot be same as old password');
        }
        const exist = await UserDetails.findOne({username})
        if(!exist){
            return res.status(400).send('User does not exist');
        }
        const validpassword = await bcrypt.compare(oldpass, exist.password);
        if(!validpassword){
            return res.status(400).send('Invalid Password');
        }
        const hashpassword = await bcrypt.hash(newpass, 10);
        const user = await UserDetails.findOneAndUpdate
        ({username:username},
            {password:hashpassword},
            {new:true})
        res.status(200).send('Password Changed');

    }
 catch(error){
    console.log(error)
    res.status(500).send('Server Error');
 }  
    


})





app.listen(5000, () => { console.log('Server is running on port 5000') })
.on('error', (err) => {
    console.error("Failed to start server:", err);
});