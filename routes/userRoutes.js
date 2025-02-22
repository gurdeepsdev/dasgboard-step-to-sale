const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');

const verifyToken = require('../middlewares/verifyToken'); // Middleware path


const router = express.Router();

router.get('/', userController.getHelloWorld);
// router.get('/users', userController.getUsers);
router.get('/users', verifyToken, userController.getUsers);
router.get('/notification/:userId', verifyToken, userController.getNotifications);

router.get('/getnotifications', userController.addNotification); 

router.post('/applyCoupon', userController.applyCoupon);

router.post('/signup', userController.signup);
router.post('/login', userController.login);

// Route to chnage details for a specific user
router.get("/users-details/:id",verifyToken, userController.getUsersDetails);

router.post("/users-change/:userId",verifyToken, userController.changePassword);

// Route to add subscribe details for user
router.post("/subscribe-details",verifyToken, userController.addsubscribeDetails);
//add coupons 
router.post("/add-coupon", userController.addCouponDetails);
// Route to get all coupons
router.get("/all-coupon", userController.getAllCoupons);
router.get("/all-couponss/:categoryName", userController.getAllCategoryCoupons);



// Route to get a specific coupon by slug

router.get("/single-coupon/:slug", userController.getCouponBySlug);


// Route to get transection history for a specific user
router.get("/tdetails/:userId",verifyToken, userController.getTransactions);


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


// router.post('/register', authMiddleware(['create_admin']), createAdmin);
// router.post('/login', loginAdmin);
// router.get('/admins', authMiddleware(['view_admins']), getAllAdmins);


module.exports = router;
