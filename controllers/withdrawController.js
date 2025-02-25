const db = require("../db/Connection"); // MySQL connection
const jwt = require('jsonwebtoken');
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
require('dotenv').config();


// Update withdrawal status (Admin)
exports.updateWithdrawalStatus = async (req, res) => {
    const { withdrawId, status } = req.body;

    if (!withdrawId || !status) {
        return res.status(400).json({ error: "Withdrawal ID and status are required" });
    }

    try {
        // Fetch withdrawal request details
        const [withdrawal] = await db.query(`SELECT * FROM withdraw WHERE id = ?`, [withdrawId]);

        if (!withdrawal.length) {
            return res.status(404).json({ error: "Withdrawal request not found" });
        }

        const { user_id, amount } = withdrawal[0];

        // Update withdrawal status
        const updateSql = `UPDATE withdraw SET status = ? WHERE id = ?`;
        await db.query(updateSql, [status, withdrawId]);

        // Handle transaction logging
        if (status === 'approved') {
            const transactionSql = `INSERT INTO transactions (wallet_id, amount, description) VALUES (?, ?, ?)`;
            await db.query(transactionSql, [user_id, -amount, 'Withdrawal approved']);
        } else if (status === 'rejected') {
            // Refund balance if rejected
            const refundWalletSql = `UPDATE wallet SET balance = balance + ? WHERE user_id = ?`;
            await db.query(refundWalletSql, [amount, user_id]);
        }

        res.status(200).json({ message: `Withdrawal request ${status} successfully` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// Multer middleware export
