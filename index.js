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
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');




app.get("/", (req, res) => {
    res.send('Hello World');
});





// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configure Multer for file uploads
const upload = multer({
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        const fileTypes = /xlsx|xls/;
        const extName = fileTypes.test(file.originalname.split('.').pop().toLowerCase());
        if (extName) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files are allowed!'));
        }
    }
});

app.post("/UserReg", upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded. Please upload an Excel file.');
    }

    try {
        // Read the uploaded Excel file
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        console.log("Parsed Excel data:", sheetData); // Debug log

        if (!Array.isArray(sheetData) || sheetData.length === 0) {
            return res.status(400).send('Invalid Excel file. Please provide a valid file with data.');
        }

        // Process each row in the Excel sheet
        const userPromises = sheetData.map(async (row) => {
            const lowerCaseUsername = row.username.toLowerCase();

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

        // Delete the file after processing
        fs.unlinkSync(req.file.path);

        res.status(200).json(results);
    } catch (err) {
        console.error("Error processing the file:", err);
        res.status(500).send('Server Error');
    }
});
app.post("/userDelete",upload.single('file'),async(req,res)=>{
    if (!req.file) {
        return res.status(400).send('No file uploaded. Please upload an Excel file.');
    }
    try{
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        // res.json(sheetData)

        const deletePromises=sheetData.map(async (row)=>{
            const lowerCaseUsername = row.username.toLowerCase();
           const exist= await UserDetails.findOne({username:lowerCaseUsername})
        //    if(!exist)
        //    {
        //     return res.send(`user ${lowerCaseUsername} does not exist.`)
        //    }
        if(exist){
             const response= await UserDetails.deleteOne({username:lowerCaseUsername})
             console.log(response)
        }
           
        //    res.status(200).send(response)
        return (`user ${lowerCaseUsername} deleted successfully.`)
            
        })
        
        const results=await Promise.all(deletePromises)
        fs.unlinkSync(req.file.path);
        res.status(200).send(results)

    }
    catch(err){
        res.status(500).send("server errror while deleteting users")
    }
})

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