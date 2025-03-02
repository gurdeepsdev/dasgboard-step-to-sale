const db = require("../db/Connection");

// Submit feedback for a coupon
exports.submitFeedback = async (req, res) => {
    const { coupon_id, feedback,user_id} = req.body;
    // const user_id = req.user.id; // Extracted from JWT token

    if (!["yes", "no"].includes(feedback)) {
        return res.status(400).json({ message: "Invalid feedback" });
    }

    try {
        // Insert or update feedback
        await db.query(
            `INSERT INTO coupon_feedback (user_id, coupon_id, feedback) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE feedback = VALUES(feedback)`,
            [user_id, coupon_id, feedback]
        );
        res.json({ message: "Feedback submitted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Database error", details: error.message });
    }
};

// Get feedback stats for a coupon
exports.getFeedbackStats = async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await db.query(
            `SELECT 
                SUM(feedback = 'yes') AS yes_count,
                SUM(feedback = 'no') AS no_count
             FROM coupon_feedback 
             WHERE coupon_id = ?`,
            [id]
        );

        const yesCount = result[0].yes_count || 0;
        const noCount = result[0].no_count || 0;
        const total = yesCount + noCount;
        const percentage = total > 0 ? Math.round((yesCount / total) * 100) : 0;

        res.json({ percentage, yesCount, noCount });
    } catch (error) {
        res.status(500).json({ error: "Database error", details: error.message });
    }
};

exports.getTopStores = async (req, res) => {
    const { sort } = req.query; // Get sorting parameter from frontend
    const orderBy = sort === "oldest" ? "ASC" : "DESC"; // Default is Newest

    try {
        const [stores] = await db.query(
            `SELECT title, logo_url, COUNT(*) AS offer_count, MIN(id) AS min_id
             FROM campaigns
             GROUP BY title, logo_url
             ORDER BY min_id ${orderBy}
             LIMIT 4`
        );

        res.json({ topStores: stores });
    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).json({ error: "Database error", details: error.message });
    }
};
