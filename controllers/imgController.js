const db = require("../db/Connection"); // MySQL connection
const multer = require("multer");
const path = require("path");

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/"); // Store images in 'uploads/' folder
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `user-${req.body.user_id}-${Date.now()}${ext}`);
    },
});

// File filter for images only
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
        cb(null, true);
    } else {
        cb(new Error("Only images are allowed"), false);
    }
};

// Multer middleware
const upload = multer({ storage, fileFilter });

// Update user image API
exports.updateUserImage = (req, res) => {
    console.log("Received File:", req.file);
    console.log("Received Body:", req.body);

    const { user_id } = req.body;
    if (!req.file || !user_id) {
        return res.status(400).json({ message: "User ID and image are required" });
    }

    const imagePath = `uploads/${req.file.filename}`;

    db.query(
        "UPDATE users SET img = ? WHERE id = ?",
        [imagePath, user_id],
        (err, result) => {
            if (err) {
                console.error("Database Error:", err);
                return res.status(500).json({ message: "Database error" });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "User not found" });
            }

            return res.status(200).json({
                success: true,
                message: "Profile image updated successfully",
                image_url: imagePath,
            });
        }
    );
};


// Multer middleware export
exports.upload = upload;
