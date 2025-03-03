const db = require('../db/Connection');
const jwt = require('jsonwebtoken');
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
require('dotenv').config();
const multer = require("multer");
const path = require("path");

const cron = require('node-cron');
const axios = require('axios');
const { transactionUtils } = require("../routes/transactionUtils"); // Import function

// const { sendNotification } = require("../socket"); // Import the function from socket.js


// Secret key for J
// WT (store this securely, e.g., in environment variables)
const JWT_SECRET = process.env.VITE_API_JWT_SECRET;

console.log("JWT_SECRET",JWT_SECRET)
// const JWT_SECRET = 'gurdeep0111';
dotenv.config();



// API URL
const API_URL = 'https://api.clickorbits.in/v2/publisher/campaigns?apiKey=67b338306b22c2db1f0eb2b9eb967b338306b265';

// Function to fetch and store data
async function fetchData() {
    try {
        const response = await axios.get(API_URL);
        const campaigns = response.data.data.campaigns;

        for (let campaign of campaigns) {
            const { id, title, description, kpi, currency, preview_url, tracking_link, categories, countries, model, payouts, creatives } = campaign;
            const payout = payouts.length > 0 ? payouts[0].payout : 0;
            const payout_model = payouts.length > 0 ? payouts[0].payout_model : '';
            
            let banner_url = null;
            let logo_url = null;
            
            // Store creatives separately
            for (let creative of creatives) {
                if (creative.title.toLowerCase() === 'banner') {
                    banner_url = creative.full_url;
                } else if (creative.title.toLowerCase() === 'logo') {
                    logo_url = creative.full_url;
                }
            }
            
            // Store campaign data
            await db.execute(`INSERT INTO campaigns (id, title, description, kpi, currency, preview_url, categories, tracking_link, countries, payout, payout_model, banner_url, logo_url) 
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
                              ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), kpi=VALUES(kpi), currency=VALUES(currency), 
                              preview_url=VALUES(preview_url), categories=VALUES(categories), tracking_link=VALUES(tracking_link), 
                              countries=VALUES(countries), payout=VALUES(payout), payout_model=VALUES(payout_model), 
                              banner_url=VALUES(banner_url), logo_url=VALUES(logo_url)`,
                [id, title, description, kpi, currency, preview_url, JSON.stringify(categories), tracking_link, JSON.stringify(countries), payout, payout_model, banner_url, logo_url]);
        }
        console.log('Data updated successfully');
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

// Schedule cron job to run every hour
cron.schedule('0,30 * * * *', fetchData);

// Run on startup
fetchData();



async function checkPendingConversions() {
    try {
        console.log("🔄 Checking pending conversions...");

        const [pendingConversions] = await db.query(
            "SELECT * FROM conversions WHERE status = 'pending'"
        );

        if (pendingConversions.length === 0) {
            console.log("✅ No pending conversions found.");
            return;
        }

        for (let conversion of pendingConversions) {
            const { id, click_id, amount, user_id } = conversion;

            // Simulating confirmation (you may need an API call here)
            const isConfirmed = true;

            if (isConfirmed) {
                await db.query("UPDATE conversions SET status = 'confirmed' WHERE id = ?", [id]);

                console.log(`✅ Conversion confirmed for Click ID: ${click_id},${user_id}`);

                if (amount) {
                    await axios.post("http://localhost:5000/api/applyCoupon", {
                        userId: user_id,  // ✅ Match Postman key
                        amountEarned: amount,  // ✅ Match Postman key
                    });
                    console.log(`🚀 High-value reward API called for User ID: ${user_id}`);
                } else {
                    // await axios.post("https://yourwebsite.com/api/regular-reward", {
                    //     user_id,
                    //     amount,
                    // });
                    console.log(`🚀 Regular reward API called for User ID: ${user_id}`);
                }
            }
        }
    } catch (error) {
        console.error("❌ Error checking pending conversions:", error);
    }
}

// Run every 30 minutes
cron.schedule("*/2 * * * *", checkPendingConversions);

exports.getHelloWorld = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT 1');
        res.status(200).json({ message: 'Hello World!' });
    } catch (error) {
        console.error('Failed to connect to the database:', error);
        res.status(500).json({ error: 'Database connection failed' });
    }
};

exports.getUsers = async (req, res) => {
    try {
        // The token is verified, and user data is available in req.user
        const [rows] = await db.query('SELECT * FROM users');
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Failed to retrieve users' });
    }
};

/*
* Get user details for a user
*/
exports.getUsersDetails = async (req, res) => {
   try {
       const { id } = req.params;

       // Fetch bank details from DB
       const [Users] = await db.query("SELECT * FROM Users WHERE id = ?", [id]);

       if (Users.length === 0) {
           return res.status(404).json({ message: "No users details found for this user" });
       }

       res.json({ Users: Users[0] });
   } catch (error) {
       console.error("Error fetching bank details:", error);
       res.status(500).json({ message: "Failed to retrieve bank details" });
   }
};

/**
 * Change user password
 */
exports.changePassword = async (req, res) => {
    try {
      const { currentPassword, newPassword, confirmNewPassword } = req.body;
      const { userId } = req.params;
  console.log("pass",currentPassword, newPassword, confirmNewPassword)
      if (!currentPassword || !newPassword || !confirmNewPassword) {
        return res.status(400).json({ message: "All fields are required" });
      }
  
      if (newPassword !== confirmNewPassword) {
        return res.status(400).json({ message: "New passwords do not match" });
      }
  
      // Get user details
      const [user] = await db.query("SELECT password FROM Users WHERE id = ?", [userId]);
  
      if (user.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
  
      const isMatch = await bcrypt.compare(currentPassword, user[0].password);
      if (!isMatch) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
  
      // Hash the new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
  
      // Update password
      await db.query("UPDATE Users SET password = ? WHERE id = ?", [hashedPassword, userId]);
  
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  };

// Generate a random referral code
const generateReferralCode = () => {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
};
// chekc email and phone number already exist or not 
exports.checkUserExists = async (req, res) => {
    try {
        const { email, phone_number } = req.body;

        let emailExists = false;
        let phoneExists = false;

        // Check if email exists (if provided)
        if (email) {
            const [emailResult] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
            if (emailResult.length > 0) {
                emailExists = true;
            }
        }

        // Check if phone number exists (if provided)
        if (phone_number) {
            const [phoneResult] = await db.query("SELECT id FROM users WHERE phone_number = ?", [phone_number]);
            if (phoneResult.length > 0) {
                phoneExists = true;
            }
        }

        // Return messages based on which one exists
        if (emailExists && phoneExists) {
            return res.status(409).json({ message: "Both email and phone number already exist" });
        } else if (emailExists) {
            return res.status(409).json({ message: "Email already exists" });
        } else if (phoneExists) {
            return res.status(409).json({ message: "Phone number already exists" });
        }

        // If neither exists
        return res.status(200).json({ message: "Email and phone number are available" });
    } catch (error) {
        console.error("Error checking user existence:", error);
        return res.status(500).json({ message: "Error checking user existence" });
    }
};


// Signup API
exports.signup = async (req, res) => {
    try {
        const { username, email, phone_number, password, referred_by } = req.body;

        // Check if the email is provided and if it already exists
        if (email) {
            const [existingEmail] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
            if (existingEmail.length > 0) {
                return res.status(409).json({ message: "Email already exists" });
            }
        }

        // Check if the phone number already exists
        const [existingPhone] = await db.query("SELECT * FROM users WHERE phone_number = ?", [phone_number]);
        if (existingPhone.length > 0) {
            return res.status(409).json({ message: "Phone number already exists" });
        }

        // Validate the referral code if provided
        let referrerId = null;
        if (referred_by) {
            const [referrer] = await db.query("SELECT id FROM users WHERE referral_code = ?", [referred_by]);
            if (referrer.length === 0) {
                return res.status(400).json({ message: "Invalid referral code" });
            }
            referrerId = referrer[0].id;
        }

        // Send a notification to the referrer when a new user signs up with their referral code



        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate a unique referral code
        const referral_code = generateReferralCode();

        // Insert the user into the users table
        const [result] = await db.query(
            "INSERT INTO users (username, email, phone_number, password, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?)",
            [username, email || null, phone_number, hashedPassword, referral_code, referrerId]
        );

        const userId = result.insertId;

        // Create a wallet for the new user
        await db.query("INSERT INTO wallet (user_id, balance) VALUES (?, ?)", [userId, 0]);

        // Retrieve the wallet balance for the new user
        const [wallet] = await db.query("SELECT balance FROM wallet WHERE user_id = ?", [userId]);

        // Send a notification to the referrer if a referral code was used
        if (referrerId) {
            const message = `${username} signed up using your referral code!`;
            await db.query("INSERT INTO notifications (user_id, message) VALUES (?, ?)", [referrerId, message]);
            // sendNotification(referrerId, message); // This will now work correctly

        }

        // Generate JWT token
        const token = jwt.sign({ userId, username, email }, JWT_SECRET, { expiresIn: "7d" });

        // Store JWT token in HTTP-only cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure:  JWT_SECRET,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        // Respond with the user details and wallet balance
        res.status(201).json({
            message: "User registered successfully!",
            userId,
            username,
            email,
            referral_code,
            balance: wallet[0]?.balance || 0, // Ensure balance is returned, default to 0 if no wallet
            token, // Optional
            phone_number,
        });
    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).json({ message: "Failed to register user" });
    }
};


// forget passowrd
exports.forgotPassword = async (req, res) => {
    try {
        const { phone_number, new_password } = req.body;

        // Check if the phone number exists
        const [user] = await db.query("SELECT id FROM users WHERE phone_number = ?", [phone_number]);
        if (user.length === 0) {
            return res.status(404).json({ message: "Phone number not found!" });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(new_password, 10);

        // Update password in the database
        await db.query("UPDATE users SET password = ? WHERE phone_number = ?", [hashedPassword, phone_number]);

        res.status(200).json({ message: "Password updated successfully!" });
    } catch (error) {
        console.error("Error resetting password:", error);
        res.status(500).json({ message: "Failed to reset password" });
    }
};




// Login API
exports.login = async (req, res) => {
    try {
        const { phone_number, password } = req.body;

        // Check if the user exists with the provided phone number
        const [user] = await db.query('SELECT * FROM users WHERE phone_number = ?', [phone_number]);
        if (user.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const existingUser = user[0];

        // Compare the provided password with the hashed password in the database
        const isPasswordValid = await bcrypt.compare(password, existingUser.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        // Fetch Wallet data for the user
        const [walletData] = await db.query('SELECT balance FROM wallet WHERE user_id = ?', [existingUser.id]);
        const walletBalance = walletData.length > 0 ? walletData[0].balance : "0.00";

        // Generate a JWT token
        const token = jwt.sign(
            {
                userId: existingUser.id,
                username: existingUser.username,
                phone_number: existingUser.phone_number,
            },
            JWT_SECRET,
            { expiresIn: '1h' } // Token expiration time
        );

        // Respond with a consistent format
        res.status(200).json({
            message: 'Login successful',
            userId: existingUser.id,
            username: existingUser.username,
            email: existingUser.email || null, // Include email if available
            referral_code: existingUser.referral_code || null, // Include referral code if available
            balance: walletBalance,
            token: token,
            phone_number:phone_number,
        });

    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Failed to login' });
    }
};

exports.checkUserExistenceOTp = async (req, res) => {
    try {
        const { phone_number } = req.body;

        if (!phone_number) {
            return res.status(400).json({ status: "Phone number is required" });
        }

        const [user] = await db.query('SELECT id FROM users WHERE phone_number = ?', [phone_number]);

        if (user.length === 0) {
            return res.status(200).json({ status: "User does not exist" });
        }

        return res.status(200).json({ status: "User exists" });

    } catch (error) {
        console.error('Error checking user existence:', error);
        return res.status(500).json({ status: "Error checking user existence" });
    }
};


// Check if user exists (for OTP verification)
exports.checkUserExistence = async (req, res) => {
    try {
        const { phone_number } = req.body;

        // Check if the user exists with the provided phone number
        const [user] = await db.query('SELECT * FROM users WHERE phone_number = ?', [phone_number]);
        if (user.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const existingUser = user[0];

        // Fetch Wallet data for the user
        const [walletData] = await db.query('SELECT balance FROM wallet WHERE user_id = ?', [existingUser.id]);
        const walletBalance = walletData.length > 0 ? walletData[0].balance : "0.00";

        // Respond with user details
        res.status(200).json({
            message: 'User found',
            userId: existingUser.id,
            username: existingUser.username,
            email: existingUser.email || null,
            referral_code: existingUser.referral_code || null,
            balance: walletBalance,
            phone_number: existingUser.phone_number,
        });

    } catch (error) {
        console.error('Error checking user existence:', error);
        res.status(500).json({ message: 'Failed to check user existence' });
    }
};


//notification 
exports.getNotifications = async (req, res) => {
    try {
        console.log("params", req.params)
        const { userId } = req.params;
        // <-- Use req.query instead of req.params 
        const [notifications] = await db.query(
            "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC",
            [userId]
        );
        console.log("notifications",notifications)
        res.json( notifications );
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ message: "Failed to fetch notifications" });
    }
};



exports.addNotification = async (req, res) => {
    try {
        const { userId, message } = req.body;

        // Insert the notification into the database

        // Emit the notification to the specific user
        // sendNotification(userId, "You have a new notification!");

        res.json({ message: "Notification sent successfully!" });
    } catch (error) {
        console.error("Error sending notification:", error);
        res.status(500).json({ message: "Failed to send notification" });
    }
};

// exports.applyCoupon = async (req, res) => {
//     try {
//         const { userId, couponId, amountEarned } = req.body;
//         let referrerBonus = 0;

//         // Fetch referrer ID of the user
//         const [user] = await db.query("SELECT referred_by FROM Users WHERE id = ?", [userId]);
// console.log("userId",userId)
//         if (user.length > 0 && user[0].referred_by) {
//             referrerBonus = amountEarned * 0.2; // 20% to referrer
//             console.log("referrerBonus",referrerBonus)

//             // Credit referrer wallet
//             await db.query("UPDATE Wallet SET balance = balance + ? WHERE user_id = ?", 
//                             [referrerBonus, user[0].referred_by]);
//         }

//         // Credit user's wallet
//         await db.query("UPDATE Wallet SET balance = balance + ? WHERE user_id = ?", 
//                         [amountEarned - referrerBonus, userId]);

//         res.json({ message: "Earnings credited successfully" });
//     } catch (error) {
//         console.error("Error applying coupon:", error);
//         res.status(500).json({ message: "Failed to apply coupon" });
//     }
// };

exports.applyCoupon = async (req, res) => {
    try {
        const { userId, couponId, amountEarned } = req.body;
        let referrerBonus = 0;

        // Fetch user details to check if they were referred
        const [user] = await db.query("SELECT referred_by FROM Users WHERE id = ?", [userId]);

        console.log("userId", userId);

        // Fetch user's wallet ID
        const [userWallet] = await db.query("SELECT id FROM Wallet WHERE user_id = ?", [userId]);
        if (userWallet.length === 0) {
            return res.status(400).json({ message: "User wallet not found" });
        }
        const userWalletId = userWallet[0].id;

        // If the user has a referrer, calculate the referrer bonus
        if (user.length > 0 && user[0].referred_by) {
            referrerBonus = amountEarned * 0.2; // 20% bonus to referrer
            const referrerId = user[0].referred_by;

            console.log("Referrer Bonus:", referrerBonus);

            // Fetch referrer's wallet ID
            const [referrerWallet] = await db.query("SELECT id FROM Wallet WHERE user_id = ?", [referrerId]);
            if (referrerWallet.length === 0) {
                return res.status(400).json({ message: "Referrer wallet not found" });
            }
            const referrerWalletId = referrerWallet[0].id;

            // Credit referrer's wallet
            await db.query("UPDATE Wallet SET balance = balance + ? WHERE user_id = ?", [referrerBonus, referrerId]);

            // Insert transaction for referrer
            await db.query(
                "INSERT INTO Transactions (wallet_id, amount, description, created_at) VALUES (?, ?, ?, NOW())",
                [referrerWalletId, referrerBonus, "Referral earnings from your friend's coupon use"]
            );

            // Insert notification for referrer
            await db.query(
                "INSERT INTO Notifications (user_id, message, is_read, created_at) VALUES (?, ?, ?, NOW())",
                [referrerId, `🎉 Wow! You got ₹${referrerBonus} from your friend's earnings!`, 0]
            );

            // Send notification via WebSocket
            // sendNotification(referrerId, `🎉 Wow! You got ₹${referrerBonus} from your friend's earnings!`);
        }

        // Calculate user's earnings after referrer bonus is deducted
        const userEarnings = amountEarned ;

        // Credit user's wallet
        await db.query("UPDATE Wallet SET balance = balance + ? WHERE user_id = ?", [userEarnings, userId]);

        // Insert transaction for user
        await db.query(
            "INSERT INTO Transactions (wallet_id, amount, description, created_at) VALUES (?, ?, ?, NOW())",
            [userWalletId, userEarnings, "Earnings from coupon usage"]
        );

        // Insert notification for user
        await db.query(
            "INSERT INTO Notifications (user_id, message, is_read, created_at) VALUES (?, ?, ?, NOW())",
            [userId, `🎉 Wow! You got ₹${userEarnings}! Use and earn more!`, 0]
        );

        // Send notification via WebSocket
        // sendNotification(userId, `🎉 Wow! You got ₹${userEarnings}! Use and earn more!`);

        res.json({ message: "Earnings credited successfully" });
    } catch (error) {
        console.error("Error applying coupon:", error);
        res.status(500).json({ message: "Failed to apply coupon" });
    }
};

const sendNotification = async (user_id, message) => {
    try {
        await db.query("INSERT INTO notifications (user_id, message) VALUES (?, ?)", [user_id, message]);
    } catch (error) {
        console.error("Error sending notification:", error);
    }
};


// Update wallet based on success or failure coupon use 

exports.updateWallet = async (req, res) => {
    const { user_id, success, amount } = req.body;

    if (!user_id || success === undefined || amount === undefined) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    let connection;

    try {
        connection = await db.getConnection(); // Get a new database connection
        await connection.beginTransaction(); // Start transaction

        if (success) {
            // 1. Update wallet balance
            await connection.query("UPDATE wallet SET balance = balance + ? WHERE user_id = ?", [amount, user_id]);

            // 2. Insert transaction
            const description = `Amount credited: ₹${amount}`;
            await connection.query("INSERT INTO transactions (wallet_id, amount, description) VALUES (?, ?, ?)", [user_id, amount, description]);

            // 3. Send success notification
            await sendNotification(user_id, "Wow! Amount added");

            await connection.commit(); // Commit transaction
            connection.release(); // Release connection

            return res.status(200).json({ success: true, message: "Amount added successfully" });
        } else {
            // Send failure notification
            await sendNotification(user_id, "Coupon use unsuccessful, try next time");

            connection.release(); // Release connection
            return res.status(200).json({ success: false, message: "Transaction failed, notification sent" });
        }
    } catch (error) {
        if (connection) {
            await connection.rollback(); // Rollback transaction on error
            connection.release(); // Release connection
        }
        console.error("Error updating wallet:", error);
        return res.status(500).json({ error: error.message });
    }
};

exports.addBankDetails = async (req, res) => {
    try {
        const { userId, acc_number, acc_holder_name, ifsc_code, bank_name } = req.body;
        console.log("Received Data:", req.body); // Log the full request body

        // Check if user already has bank details
        const [existing] = await db.query("SELECT * FROM Bankdetails WHERE user_id = ?", [userId]);
        if (existing.length > 0) {
            return res.status(400).json({ message: "Bank details already exist for this user. Please update instead." });
        }

        // Insert new bank details
        await db.query(
            "INSERT INTO Bankdetails (user_id, acc_number, acc_holder_name, ifsc_code, bank_name) VALUES (?, ?, ?, ?, ?)",
            [userId, acc_number, acc_holder_name, ifsc_code, bank_name]
        );

        res.status(201).json({ message: "Bank details added successfully" });
    } catch (error) {
        console.error("Error adding bank details:", error);
        res.status(500).json({ message: "Failed to add bank details" });
    }
};


/**
 * Get bank details for a user
 */
exports.getBankDetails = async (req, res) => {
    try {
        const { userId } = req.params;

        // Fetch bank details from DB
        const [bankDetails] = await db.query("SELECT * FROM Bankdetails WHERE user_id = ?", [userId]);

        if (bankDetails.length === 0) {
            return res.status(404).json({ message: "No bank details found for this user" });
        }

        res.json( bankDetails[0] );
    } catch (error) {
        console.error("Error fetching bank details:", error);
        res.status(500).json({ message: "Failed to retrieve bank details" });
    }
};

/**
 * Update bank details for a user
 */
exports.updateBankDetails = async (req, res) => {
    try {
        const { userId } = req.params;
        const { acc_number, acc_holder_name, ifsc_code, bank_name } = req.body;

        // Check if bank details exist
        const [existing] = await db.query("SELECT * FROM Bankdetails WHERE user_id = ?", [userId]);
        if (existing.length === 0) {
            return res.status(404).json({ message: "No bank details found. Please add first." });
        }

        // Update bank details
        await db.query(
            "UPDATE Bankdetails SET acc_number = ?, acc_holder_name = ?, ifsc_code = ?, bank_name = ? WHERE user_id = ?",
            [acc_number, acc_holder_name, ifsc_code, bank_name, userId]
        );

        res.json({ message: "Bank details updated successfully" });
    } catch (error) {
        console.error("Error updating bank details:", error);
        res.status(500).json({ message: "Failed to update bank details" });
    }
};

/**
 * Add upi details for a user
 */
exports.addupiDetails = async (req, res) => {
    try {
        const { userId, upi } = req.body;

        // Check if user already has bank details
        const [existing] = await db.query("SELECT * FROM Upidetails WHERE user_id = ?", [userId]);
        if (existing.length > 0) {
            return res.status(400).json({ message: "Upi details already exist for this user. Please update instead." });
        }

        // Insert new bank details
        await db.query(
            "INSERT INTO Upidetails (user_id, upi) VALUES (?, ?)",
            [userId, upi]
        );

        res.status(201).json({ message: "UPI details added successfully" });
    } catch (error) {
        console.error("Error adding bank details:", error);
        res.status(500).json({ message: "Failed to add bank details" });
    }
};

/**
 * Update upi details for a user
 */
exports.updateUpiDetails = async (req, res) => {
    try {
        const { userId } = req.params;
        const { upi } = req.body;
        // Check if bank details exist
        const [existing] = await db.query("SELECT * FROM Upidetails WHERE user_id = ?", [userId]);
        if (existing.length === 0) {
            return res.status(404).json({ message: "No Upi details found. Please add first." });
        }

        // Update bank details
        await db.query(
            "UPDATE Upidetails SET upi = ? WHERE user_id = ?",
            [upi, userId]
        );

        res.json({ message: "Upi details updated successfully" });
    } catch (error) {
        console.error("Error updating bank details:", error);
        res.status(500).json({ message: "Failed to update bank details" });
    }
};

/**
 * Get bank details for a user
 */
exports.getUpiDetails = async (req, res) => {
    try {
        const { userId } = req.params;

        // Fetch bank details from DB
        const [Upidetails] = await db.query("SELECT * FROM Upidetails WHERE user_id = ?", [userId]);

        if (Upidetails.length === 0) {
            return res.status(404).json({ message: "No upi details found for this user" });
        }

        res.json( Upidetails[0] );
    } catch (error) {
        console.error("Error fetching bank details:", error);
        res.status(500).json({ message: "Failed to retrieve bank details" });
    }
};

/**
 * Get transection history
 */
exports.getTransactions = async (req, res) => {
    try {
        const { userId } = req.params;
        console.log("userId:", userId);

        // Directly query the Transactions table since wallet_id is actually user_id
        const [transactions] = await db.query(
            `SELECT * FROM Transactions WHERE wallet_id = ?`, 
            [userId]
        );

        if (transactions.length === 0) {
            return res.status(404).json({ message: "No transactions found for this user" });
        }

        res.json(transactions);
    } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).json({ message: "Failed to retrieve transactions" });
    }
};



/**
 * Add upi details for a user
 */
exports.addsubscribeDetails = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        // Check if email already exists
        const [existingEmail] = await db.query(
            "SELECT email FROM subscribe WHERE email = ?",
            [email]
        );

        if (existingEmail.length > 0) {
            return res.status(409).json({ message: "Email already subscribed" });
        }

        // Insert new email into the subscribe table
        await db.query(
            "INSERT INTO subscribe (email) VALUES (?)",
            [email]
        );

        res.status(201).json({ message: "Email subscribed successfully" });
    } catch (error) {
        console.error("Error adding email details:", error);
        res.status(500).json({ message: "Failed to subscribe email" });
    }
};


// ✅ Add a new coupon with SEO details

// ✅ Add a new coupon with SEO details
exports.addCouponDetails = async (req, res) => {
    try {
        const { title, offer, amount, code, expiry_date, seo_title, seo_description, slug ,categore} = req.body;

        // Validate required fields
        if (!title || !offer || !amount || !code || !expiry_date || !seo_title || !seo_description || !slug || !categore)  {
            return res.status(400).json({ message: "All fields are required!" });
        }

        // Check if the coupon code already exists
        const [existingCoupon] = await db.query(
            "SELECT id FROM coupons WHERE code = ?",
            [code]
        );

        if (existingCoupon.length > 0) {
            return res.status(409).json({ message: "Coupon code already exists!" });
        }

        // Check if the slug already exists for SEO
        const [existingSlug] = await db.query(
            "SELECT id FROM coupon_seo WHERE slug = ?",
            [slug]
        );

        if (existingSlug.length > 0) {
            return res.status(409).json({ message: "Slug already exists!" });
        }

        // Start transaction
        await db.query("START TRANSACTION");

        // Insert into coupons table
        const [couponResult] = await db.query(
            "INSERT INTO coupons (title, offer, amount, code, expiry_date, categore) VALUES (?, ?, ?, ?, ?, ?)",
            [title, offer, amount, code, expiry_date, categore]
        );

        const coupon_id = couponResult.insertId;

        // Insert into coupon_seo table
        await db.query(
            "INSERT INTO coupon_seo (coupon_id, seo_title, seo_description, slug) VALUES (?, ?, ?, ?)",
            [coupon_id, seo_title, seo_description, slug]
        );

        // Commit transaction
        await db.query("COMMIT");

        res.status(201).json({ message: "Coupon added successfully!", coupon_id });
    } catch (error) {
        console.error("Error adding coupon:", error);
        await db.query("ROLLBACK");
        res.status(500).json({ message: "Failed to add coupon" });
    }
};


// ✅ Fetch all coupons with SEO details
exports.getAllCoupons = async (req, res) => {
    try {
        const [coupons] = await db.query(`
            SELECT c.id, c.title, c.offer, c.amount, c.code, c.expiry_date, c.categore,
                   s.seo_title, s.seo_description, s.slug
            FROM coupons c
            JOIN coupon_seo s ON c.id = s.coupon_id
            ORDER BY c.id DESC
        `);

        res.status(200).json({ success: true, data: coupons });
    } catch (error) {
        console.error("Error fetching coupons:", error);
        res.status(500).json({ message: "Failed to fetch coupons" });
    }
};

// ✅ Fetch all coupons with SEO details (filtered by category if provided)

exports.getAllCategoryCoupons = async (req, res) => {
    try {
        const { categoryName } = req.params; // Get category name from frontend

        let query = `
            SELECT id, title, description, currency, preview_url, tracking_link, 
                   categories, payout, payout_model, banner_url, logo_url
            FROM campaigns
        `;

        const values = [];

        // If categoryName is not "All", filter by category
        if (categoryName && categoryName !== "All") {
            query += ` WHERE JSON_UNQUOTE(categories) LIKE ?`;
            values.push(`%${categoryName}%`);
        }

        query += ` ORDER BY id DESC`;

        const [campaigns] = await db.query(query, values);

        res.status(200).json({
            success: true,
            message: campaigns.length ? "Campaigns fetched successfully" : "No campaigns found",
            data: campaigns
        });
    } catch (error) {
        console.error("Error fetching campaigns:", error);
        res.status(500).json({ message: "Failed to fetch campaigns" });
    }
};








// ✅ Get campaign details by title
exports.getCouponBySlug = async (req, res) => {
    try {
        const { slug } = req.params; // Extract title from request params
console.log("slug",slug)

        const [campaigns] = await db.query(
            `SELECT * FROM campaigns WHERE title = ?`, 
            [slug]
        );

        if (campaigns.length === 0) {
            return res.status(404).json({ message: "Campaign not found" });
        }

        res.status(200).json({ success: true, data: campaigns[0] });
    } catch (error) {
        console.error("Error fetching campaign:", error);
        res.status(500).json({ message: "Failed to fetch campaign" });
    }
};



// Create a withdrawal request

// Create a withdrawal request with a proper transaction
exports.createWithdrawal = async (req, res) => {
    const { userId, amount, type } = req.body;

    if (!userId || !amount || !type) {
        return res.status(400).json({ error: "All fields are required" });
    }

    let connection;

    try {
        // Get a connection from the pool
        connection = await db.getConnection();
        await connection.beginTransaction(); // Start transaction

        // Insert withdrawal request
        const withdrawSql = `INSERT INTO withdraw (user_id, amount, type, status) VALUES (?, ?, ?, 'pending')`;
        await connection.query(withdrawSql, [userId, amount, type]);

        // Record the transaction
        const transactionSql = `INSERT INTO transactions (wallet_id, amount, description) VALUES (?, ?, ?)`;
        await connection.query(transactionSql, [userId, amount, 'Withdrawal request created']);

        // Deduct amount from user’s wallet
        const updateWalletSql = `UPDATE wallet SET balance = balance - ? WHERE user_id = ? AND balance >= ?`;
        const [walletResult] = await connection.query(updateWalletSql, [amount, userId, amount]);

                // Fetch updated wallet balance
                const balanceSql = `SELECT balance FROM wallet WHERE user_id = ?`;
                const [balanceResult] = await connection.query(balanceSql, [userId]);
                const updatedBalance = balanceResult[0]?.balance || 0;
        

        if (walletResult.affectedRows === 0) {
            await connection.rollback(); // Rollback if insufficient balance
            return res.status(400).json({ error: "Insufficient balance" });
        }

        await connection.commit(); // Commit transaction
        res.status(201).json({ 
            message: "Withdrawal request submitted successfully",
            updatedBalance 
        });

    } catch (error) {
        if (connection) await connection.rollback(); // Rollback on error
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release(); // Release connection
    }
};



// Get all withdrawals for a user
exports.getWithdrawalsByUser = async (req, res) => {
    const { userId } = req.params;

    try {
        const sql = `SELECT * FROM withdraw WHERE user_id = ? ORDER BY created_at DESC`;
        db.query(sql, [userId], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.status(200).json({ success: true, data: results });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all withdrawal requests (Admin API)
exports.getAllWithdrawRequests = async (req, res) => {
    try {
        // Use `await` with promise-based MySQL query
        const [results] = await db.query(`SELECT * FROM withdraw ORDER BY created_at DESC`);
        
        res.status(200).json({ success: true, data: results });
    } catch (error) {
        console.error("Error fetching withdrawal requests:", error);
        res.status(500).json({ error: error.message });
    }
};




exports.createAdmin = async (req, res) => {
    const { email, password, role, permissions } = req.body;
    
    if (!email || !password || !role || !permissions) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        // Hash the password before storing it
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert into database
        const sql = `INSERT INTO admins (email, password, role, permissions) VALUES (?, ?, ?, ?)`;
        db.query(sql, [email, hashedPassword, role, JSON.stringify(permissions)], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });

            res.status(201).json({ message: "Sub-admin created successfully" });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.loginAdmin = async (req, res) => {
    try {
        console.log("🟢 Login Request Received:", req.body);

        const { email, password } = req.body;

        // ✅ Validation: Ensure both email and password are provided
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        // ✅ Fetch Admin by Email
        const [results] = await db.query("SELECT * FROM admins WHERE email = ?", [email]);

        if (!results.length) {
            console.warn("⚠️ Admin not found");
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const admin = results[0];

        // ✅ Verify Password
        const passwordMatch = await bcrypt.compare(password, admin.password);

        if (!passwordMatch) {
            console.warn("⚠️ Incorrect password");
            return res.status(401).json({ message: "Invalid credentials" });
        }

        console.log("✅ Admin logged in successfully!");
        res.status(200).json({
            success: true,
            message: "Login successful",
            admin: {
                id: admin.id,
                email: admin.email,
            },
        });

    } catch (error) {
        console.error("❌ Server Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};



// // Register Admin
// exports.createAdmin = async (req, res) => {
//     const { email, password, role, permissions } = req.body;
//     try {
//         const hashedPassword = await bcrypt.hash(password, 10);
//         const sql = `INSERT INTO admins (email, password, role, permissions) VALUES (?, ?, ?, ?)`;
//         db.query(sql, [email, hashedPassword, role, JSON.stringify(permissions)], (err, result) => {
//             if (err) return res.status(500).json({ error: err.message });
//             res.status(201).json({ message: 'Admin created successfully' });
//         });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

// // Login Admin
// exports.loginAdmin = (req, res) => {
//     const { email, password } = req.body;
//     const sql = `SELECT * FROM admins WHERE email = ?`;
//     db.query(sql, [email], async (err, results) => {
//         if (err || results.length === 0) return res.status(401).json({ message: 'Invalid credentials' });

//         const admin = results[0];
//         const passwordMatch = await bcrypt.compare(password, admin.password);
//         if (!passwordMatch) return res.status(401).json({ message: 'Invalid credentials' });

//         const token = jwt.sign(
//             { id: admin.id, email: admin.email, role: admin.role, permissions: JSON.parse(admin.permissions) },
//             process.env.JWT_SECRET,
//             { expiresIn: '1h' }
//         );

//         res.cookie('token', token, { httpOnly: true });
//         res.json({ message: 'Login successful', token });
//     });
// };

// // Get All Admins (Only Super Admin)
// exports.getAllAdmins = (req, res) => {
//     db.query('SELECT id, email, role, permissions FROM admins', (err, results) => {
//         if (err) return res.status(500).json({ error: err.message });
//         res.json(results);
//     });
// };

// exports.upload = upload;
