const express = require('express');
const userController = require('../controllers/userController');
const verifyToken = require('../middlewares/verifyToken'); // Middleware path


const router = express.Router();

router.get('/', userController.getHelloWorld);
// router.get('/users', userController.getUsers);
router.get('/users', verifyToken, userController.getUsers);
router.get('/notification', verifyToken, userController.getNotifications);

router.get('/getnotifications', userController.addNotification); 

router.post('/applyCoupon', userController.applyCoupon);

router.post('/signup', userController.signup);
router.post('/login', userController.login);

// Route to chnage details for a specific user
router.get("/users-details/:id",verifyToken, userController.getUsersDetails);

router.post("/users-change/:userId",verifyToken, userController.changePassword);


// Route to add upi details
router.post("/upi-details", userController.addupiDetails);   
// Route to update upi details
router.put("/upi-details/:userId", userController.updateUpiDetails);  
// Route to get upi details for a specific user
router.get("/upi-details/:userId", userController.getUpiDetails);


// Route to add bank details
router.post("/bank-details", userController.addBankDetails); 

// Route to get bank details for a specific user
router.get("/bank-details/:userId", userController.getBankDetails);

// Route to update bank details
router.put("/bank-details/:userId", userController.updateBankDetails);
module.exports = router;
