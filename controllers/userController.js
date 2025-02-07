const db = require('../db/Connection');
const jwt = require('jsonwebtoken');
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");

// const { sendNotification } = require("../socket"); // Import the function from socket.js


// Secret key for JWT (store this securely, e.g., in environment variables)
const JWT_SECRET = 'gurdeep0111';
dotenv.config();


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





// Generate a random referral code
const generateReferralCode = () => {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
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
        });
    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).json({ message: "Failed to register user" });
    }
};



// exports.signup = async (req, res) => {
//     try {
//         const { username, email, phone_number, password, referred_by } = req.body;

//         // Check if the phone number already exists
//         const [existingUser] = await db.query('SELECT * FROM users WHERE phone_number = ?', [phone_number]);
//         if (existingUser.length > 0) {
//             return res.status(409).json({ message: 'Phone number already exists' });
//         }

//         // Validate the referral code if provided
//         if (referred_by) { 
//             const [referrer] = await db.query('SELECT * FROM users WHERE referral_code = ?', [referred_by]);
//             if (referrer.length === 0) {
//                 return res.status(400).json({ message: 'Invalid referral code' });
//             }
//         }

//         // Generate a unique referral code for the new user
//         const referral_code = generateReferralCode();

//         // Insert the user into the users table
//         const [result] = await db.query(
//             'INSERT INTO users (username, email, phone_number, password, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?)',
//             [username, email, phone_number, password, referral_code, referred_by || null]
//         );

//         const userId = result.insertId;

//         // Create a wallet with the initial balance
//         let initialBalance = 0;

//         if (referred_by) {
//             // Add referral bonus to the new user's wallet
//             initialBalance = 25;

//             // Add a transaction for the referral bonus
//             const [referrerWallet] = await db.query(
//                 'SELECT id FROM Wallet WHERE user_id = (SELECT id FROM users WHERE referral_code = ?)',
//                 [referred_by]
//             );

//             if (referrerWallet.length > 0) {
//                 await db.query(
//                     'INSERT INTO Transactions (wallet_id, amount, description) VALUES (?, ?, ?)',
//                     [referrerWallet[0].id, 25, 'Referral bonus for referred user']
//                 );
//             }
//         }

//         // Insert a wallet for the new user
//         const [walletResult] = await db.query(
//             'INSERT INTO Wallet (user_id, balance) VALUES (?, ?)',
//             [userId, initialBalance]
//         );

//         res.status(201).json({
//             message: 'User registered successfully!',
//             userId,
//             referral_code,
//             walletId: walletResult.insertId,
//         });
//     } catch (error) {
//         console.error('Error during signup:', error);
//         res.status(500).json({ message: 'Failed to register user' });
//     }
// };


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
        });

    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ message: 'Failed to login' });
    }
};


exports.getNotifications = async (req, res) => {
    try {
        console.log("params", req.query)
        const { userId } = req.query; // <-- Use req.query instead of req.params 
        const [notifications] = await db.query(
            "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC",
            [userId]
        );
        res.json({ notifications });
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



exports.addBankDetails = async (req, res) => {
    try {
        const { user_id, acc_number, acc_holder_name, ifsc_code, bank_name } = req.body;

        // Check if user already has bank details
        const [existing] = await db.query("SELECT * FROM Bankdetails WHERE user_id = ?", [user_id]);
        if (existing.length > 0) {
            return res.status(400).json({ message: "Bank details already exist for this user. Please update instead." });
        }

        // Insert new bank details
        await db.query(
            "INSERT INTO Bankdetails (user_id, acc_number, acc_holder_name, ifsc_code, bank_name) VALUES (?, ?, ?, ?, ?)",
            [user_id, acc_number, acc_holder_name, ifsc_code, bank_name]
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

        res.json({ bankDetails: bankDetails[0] });
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