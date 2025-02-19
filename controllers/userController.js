const db = require('../db/Connection');
const jwt = require('jsonwebtoken');
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
require('dotenv').config();


// const { sendNotification } = require("../socket"); // Import the function from socket.js


// Secret key for J
// WT (store this securely, e.g., in environment variables)
const JWT_SECRET = process.env.VITE_API_JWT_SECRET;

console.log("JWT_SECRET",JWT_SECRET)
// const JWT_SECRET = 'gurdeep0111';
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
      await db.query("UPDATE Users SET password = ? WHERE id = ?", [hashedPassword, id]);
  
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
        console.log("userId",userId)

        // Query to fetch transactions based on user_id
        const [transactions] = await db.query(
            `SELECT t.* 
            FROM Transactions t
            JOIN Wallet w ON t.wallet_id = w.id
            WHERE w.user_id = ?`, 
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
        const { title, offer, amount, code, expiry_date, seo_title, seo_description, slug } = req.body;

        // Validate required fields
        if (!title || !offer || !amount || !code || !expiry_date || !seo_title || !seo_description || !slug) {
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
            "INSERT INTO coupons (title, offer, amount, code, expiry_date) VALUES (?, ?, ?, ?, ?)",
            [title, offer, amount, code, expiry_date]
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
            SELECT c.id, c.title, c.offer, c.amount, c.code, c.expiry_date, 
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

// ✅ Fetch a single coupon by slug
exports.getCouponBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
console.log("slug",slug)
        const [coupon] = await db.query(`
            SELECT c.id, c.title, c.offer, c.amount, c.code, c.expiry_date, 
                   s.seo_title, s.seo_description, s.slug
            FROM coupons c
            JOIN coupon_seo s ON c.id = s.coupon_id
            WHERE s.slug = ?
        `, [slug]);

        if (coupon.length === 0) {
            return res.status(404).json({ message: "Coupon not found" });
        }

        res.status(200).json({ success: true, data: coupon[0] });
    } catch (error) {
        console.error("Error fetching coupon:", error);
        res.status(500).json({ message: "Failed to fetch coupon" });
    }
};
