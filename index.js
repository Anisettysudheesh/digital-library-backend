const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
const { UserDetails, Counter, MonthlyCounter } = require("./mongo");
const dotEnv = require('dotenv');
const bcrypt = require('bcrypt');
dotEnv.config();
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
app.use(express.json());
const middleware = require('./middleware/middleware');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// Mail transporter for cron notifications
const mailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    } : undefined
});

const sendArchiveEmail = async ({ month, year, count }) => {
    if (!process.env.MAIL_TO) {
        console.warn("MAIL_TO not set; skipping archive email.");
        return;
    }

    try {
        await mailTransporter.sendMail({
            from: process.env.MAIL_FROM || process.env.SMTP_USER,
            to: process.env.MAIL_TO,
            subject: `Digital Library - Monthly Report for ${month} ${year}`,
            text: `Hello,\n\nThis is an automated notification from the Digital Library system.\n\nMonthly Statistics:\n- Month: ${month} ${year}\n- Total Logins: ${count}\n- Archived Date: ${new Date().toLocaleDateString()}\n\nThe counter has been reset to 0.\n\nBest regards,\nDigital Library System`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #007bff;">Digital Library - Monthly Report</h2>
                    <p>Hello,</p>
                    <p>This is an automated notification from the Digital Library system.</p>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #333;">Monthly Statistics</h3>
                        <p><strong>Month:</strong> ${month} ${year}</p>
                        <p><strong>Total Logins:</strong> ${count}</p>
                        <p><strong>Archived Date:</strong> ${new Date().toLocaleDateString()}</p>
                    </div>
                    <p style="color: #666; font-size: 12px; margin-top: 30px;">Best regards,<br>Digital Library System</p>
                </div>
            `
        });
        console.log(`Archive email sent for ${month} ${year}`);
    } catch (err) {
        console.error("Failed to send archive email:", err);
    }
};




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
console.log(new Date().getDate())
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

app.put("/Counter",async(req,res)=>{
    try {
        // Increment the existing counter by 1
        const result = await Counter.findOneAndUpdate(
            {},
            { $inc: { counter: 1 } },
            { new: true }
        );

        if (!result) {
            return res.status(404).send('Counter document not found');
        }

        res.status(200).json(result);
    } catch (err) {
        console.error("Error while updating counter", err);
        res.status(500).send('Server Error');
    }
})

// Schedule counter archiving daily at 7:20 PM (19:20)
cron.schedule('0 0 1 * *', async () => {
    try {
        console.log("Running daily counter archival job...");
        const now = new Date();
        console.log(`[cron] archive job fired at ${now.toISOString()}`);
        const currentCounter = await Counter.findOne({});
        console.log(`Current counter:`, currentCounter);
        
        if (currentCounter) {
            const monthNames = ["January", "February", "March", "April", "May", "June",
                               "July", "August", "September", "October", "November", "December"];
            const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
            const yearForLastMonth = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
            const month = monthNames[lastMonth];
            console.log(`Checking for existing archive: ${month} ${yearForLastMonth}`);
            
            // Check if already archived for this month/year
            const existingArchive = await MonthlyCounter.findOne({ 
                month: month, 
                year: yearForLastMonth 
            });
            console.log(`Existing archive found:`, existingArchive);
            
            if (!existingArchive) {
                // Save current counter to monthly archive
                const monthlyRecord = new MonthlyCounter({
                    month: month,
                    year: yearForLastMonth,
                    count: currentCounter.counter
                });
                await monthlyRecord.save();
                await sendArchiveEmail({ month, year: yearForLastMonth, count: currentCounter.counter });
                
                // Reset counter to 0
                await Counter.findOneAndUpdate(
                    {},
                    { counter: 0 },
                    { new: true }
                );
                
                console.log(`Counter archived for ${month} ${yearForLastMonth}: ${currentCounter.counter}`);
            } else {
                console.log(`Archive already exists for ${month} ${yearForLastMonth}, skipping.`);
            }
        } else {
            console.log(`Counter document not found in database.`);
        }
    } catch (err) {
        console.error("Error in counter archival cron job:", err);
    }
});

app.get("/monthlyCounters", async(req, res) => {
    try {
        const { fromDate, toDate } = req.query;
        
        let query = {};
        
        if (fromDate || toDate) {
            query.archivedAt = {};
            
            if (fromDate) {
                query.archivedAt.$gte = new Date(fromDate);
            }
            if (toDate) {
                // Add 1 day to include the toDate in results
                const endDate = new Date(toDate);
                endDate.setDate(endDate.getDate() + 1);
                query.archivedAt.$lt = endDate;
            }
        }
        
        const records = await MonthlyCounter.find(query).sort({ year: -1, archivedAt: -1 });
        res.status(200).json(records);
    } catch (err) {
        console.error("Error fetching monthly counters", err);
        res.status(500).send('Server Error');
    }
})

app.get("/Counter", async(req, res) => {
    try {
        const counter = await Counter.findOne({});
        res.status(200).json(counter || { counter: 0 });
    } catch (err) {
        console.error("Error fetching counter", err);
        res.status(500).send('Server Error');
    }
})




app.listen(5000, () => { console.log('Server is running on port 5000') })
.on('error', (err) => {
    console.error("Failed to start server:", err);
});