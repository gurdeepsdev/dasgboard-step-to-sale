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

// File filter to allow only images
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
        cb(null, true);
    } else {
        cb(new Error("Only images are allowed"), false);
    }
};

// Multer middleware
const upload = multer({ storage, fileFilter });

exports.updateUserImage = async (req, res) => {
    try {
        console.log("🟢 Received File:", req.file);
        console.log("🟢 Received Body:", req.body);

        const { user_id } = req.body;

        // ✅ Validation: Ensure file and user_id are provided
        if (!req.file || !user_id) {
            return res.status(400).json({ message: "User ID and image are required" });
        }

        // ✅ Corrected Image Path
        const imagePath = `/uploads/${req.file.filename}`;
        const fullImageUrl = ` https://api.steptosale.com${imagePath}`;
        //         http://localhost:5000${imagePath}


        console.log("🔹 Image Path:", imagePath);
        console.log("🔹 Full Image URL:", fullImageUrl);

        // ✅ Database Query: Update user image
        const [result] = await db.query("UPDATE users SET img = ? WHERE id = ?", [imagePath, user_id]);

        if (result.affectedRows === 0) {
            console.warn("⚠️ User not found");
            return res.status(404).json({ message: "User not found" });
        }

        console.log("✅ Image updated successfully!");
        res.status(200).json({
            success: true,
            message: "Profile image updated successfully",
            image_url: fullImageUrl,
        });

    } catch (error) {
        console.error("❌ Server Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};



// Export multer middleware for routes
exports.upload = upload;