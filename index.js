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
console.log(process.env.MONGO_URL);
console.log(process.env.jwtSecret)
const multer = require('multer');
const xlsx = require('xlsx');

// Configure Multer for file uploads
const upload = multer({ dest: 'uploads/' });


app.get("/", (req, res) => {
    res.send('Hello World');
});

// app.post("/UserReg", async (req, res) => {
//     const users = req.body;

//     if (!Array.isArray(users) || users.length === 0) {
//         return res.status(400).send('Invalid input. Please provide an array of users.');
//     }

//     try {
//         const userPromises = users.map(async (user) => {
//             const lowerCaseUsername = user.username.toLowerCase();

//             // Check if the user already exists
//             const exist = await UserDetails.findOne({ username: lowerCaseUsername });
//             if (exist) {
//                 return { username: lowerCaseUsername, status: 'User already exists' };
//             }

//             // Hash the password and save the user
//             const hashpassword = await bcrypt.hash(user.password, 10);
//             const newUser = new UserDetails({
//                 username: lowerCaseUsername,
//                 password: hashpassword,
//             });

//             await newUser.save();
//             return { username: lowerCaseUsername, status: 'User registered successfully' };
//         });

      
//         const results = await Promise.all(userPromises);

//         res.status(200).json(results);
//     } catch (err) {
//         console.error(err);
//         res.status(500).send('Server Error');
//     }
// });
 // Files will be temporarily stored in the 'uploads' folder

app.post("/UserReg", upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded. Please upload an Excel file.');
    }

    try {
        // Read the uploaded Excel file
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0]; // Get the first sheet
        const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]); // Convert sheet to JSON

        // Validate the data
        if (!Array.isArray(sheetData) || sheetData.length === 0) {
            return res.status(400).send('Invalid Excel file. Please provide a valid file with data.');
        }

        // Process each row in the Excel sheet
        const userPromises = sheetData.map(async (row) => {
            const lowerCaseUsername = row.username.toLowerCase(); // Convert username to lowercase

            // Check if the user already exists
            const exist = await UserDetails.findOne({ username: lowerCaseUsername });
            if (exist) {
                return { username: lowerCaseUsername, status: 'User already exists' };
            }

            // Hash the password and save the user
            const hashpassword = await bcrypt.hash(row.password, 10);
            const newUser = new UserDetails({
                username: lowerCaseUsername,
                password: hashpassword,
            });

            await newUser.save();
            return { username: lowerCaseUsername, status: 'User registered successfully' };
        });

        // Wait for all user registration promises to resolve
        const results = await Promise.all(userPromises);

        res.status(200).json(results);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});


app.post("/UserLogin", async (req, res) => {
    const { username, password } = req.body;

    try {
        const exist = await UserDetails.findOne({ username });
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