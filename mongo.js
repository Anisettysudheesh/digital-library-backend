const mongoose = require ('mongoose');
require('dotenv').config();


mongoose.connect(process.env.MONGO_URL)
.then(()=>{console.log('Connected to MongoDB')})
.catch((err)=>{console.log('Error:',err)});  

if (!process.env.MONGO_URL) {
    console.error("MONGO_URL is not defined in the environment variables.");
    process.exit(1);
}

const userSchema = new mongoose.Schema({
    username:{
        type:String,
        required:true
    },
    password:{
        type:String,
        required:true
    }
},
{ timestamps: true });

module.exports = mongoose.model("UserDetails",userSchema);