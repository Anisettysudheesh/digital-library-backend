const mongoose = require ('mongoose');
require('dotenv').config();

if (!process.env.MONGO_URL) {
    console.error("MONGO_URL is not defined in the environment variables.");
    process.exit(1);
}

mongoose.connect(process.env.MONGO_URL)
.then(()=>{console.log('Connected to MongoDB')})
.catch((err)=>{console.log('Error:',err)});

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    }
}, { timestamps: true });

const counterSchema = new mongoose.Schema({
    counter: {
        type: Number,
        required: true
    }
});

const monthlyCounterSchema = new mongoose.Schema({
    month: {
        type: String,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    count: {
        type: Number,
        required: true
    },
    archivedAt: {
        type: Date,
        default: Date.now
    }
});

const UserDetails = mongoose.model("UserDetails", userSchema);
const Counter = mongoose.model("Counter", counterSchema);
const MonthlyCounter = mongoose.model("MonthlyCounter", monthlyCounterSchema);

module.exports = { UserDetails, Counter, MonthlyCounter };

