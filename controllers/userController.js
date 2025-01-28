const db = require('../db/Connection');
const jwt = require('jsonwebtoken');


// Secret key for JWT (store this securely, e.g., in environment variables)
const JWT_SECRET = 'gurdeep0111';


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

        // Check if the phone number already exists
        const [existingUser] = await db.query('SELECT * FROM users WHERE phone_number = ?', [phone_number]);
        if (existingUser.length > 0) {
            return res.status(409).json({ message: 'Phone number already exists' });
        }

        // Validate the referral code if provided
        if (referred_by) {
            const [referrer] = await db.query('SELECT * FROM users WHERE referral_code = ?', [referred_by]);
            if (referrer.length === 0) {
                return res.status(400).json({ message: 'Invalid referral code' });
            }
        }

        // Generate a unique referral code for the new user
        const referral_code = generateReferralCode();

        // Insert the user into the users table
        const [result] = await db.query(
            'INSERT INTO users (username, email, phone_number, password, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?)',
            [username, email, phone_number, password, referral_code, referred_by || null]
        );

        const userId = result.insertId;

        // Create a wallet with the initial balance
        let initialBalance = 0;

        if (referred_by) {
            // Add referral bonus to the new user's wallet
            initialBalance = 25;

            // Add a transaction for the referral bonus
            const [referrerWallet] = await db.query(
                'SELECT id FROM Wallet WHERE user_id = (SELECT id FROM users WHERE referral_code = ?)',
                [referred_by]
            );

            if (referrerWallet.length > 0) {
                await db.query(
                    'INSERT INTO Transactions (wallet_id, amount, description) VALUES (?, ?, ?)',
                    [referrerWallet[0].id, 25, 'Referral bonus for referred user']
                );
            }
        }

        // Insert a wallet for the new user
        const [walletResult] = await db.query(
            'INSERT INTO Wallet (user_id, balance) VALUES (?, ?)',
            [userId, initialBalance]
        );

        res.status(201).json({
            message: 'User registered successfully!',
            userId,
            referral_code,
            walletId: walletResult.insertId,
        });
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({ message: 'Failed to register user' });
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
  
      // Check if the provided password matches the user's password
      if (existingUser.password !== password) {
        return res.status(401).json({ message: 'Invalid password' });
      }
  
      // Fetch Wallet data for the user
      const [wallet] = await db.query('SELECT * FROM wallet WHERE user_id = ?', [existingUser.id]);
  
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
  
      // Respond with user, token, and wallet data
      res.status(200).json({
        message: 'Login successful',
        token,
        user: {
          id: existingUser.id,
          username: existingUser.username,
          phone_number: existingUser.phone_number,
        },
        wallet: wallet || null, // Include wallet data, null if no wallet exists
      });
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ message: 'Failed to login' });
    }
  };
  

