const express = require('express');
const userController = require('../controllers/userController');
const {getAllCoupons,loginAdmin,createAdmin,getUserFinancialDetails} = require('../controllers/adminController');

const withdrawController = require('../controllers/withdrawController');
const getCampainController = require('../controllers/getCampainController');
const { submitFeedback, getFeedbackStats, getTopStores } = require("../controllers/feedbackController");


const authMiddleware = require('../middlewares/authMiddleware');
const { updateUserImage, upload } = require("../controllers/imgController");

const verifyToken = require('../middlewares/verifyToken'); // Middleware path


const router = express.Router();

router.get('/', userController.getHelloWorld);
// router.get('/users', userController.getUsers);
router.get('/users', userController.getUsers);
router.get('/notification/:userId', verifyToken, userController.getNotifications);

router.get('/getnotifications', userController.addNotification); 
//get compains
router.get('/get-campains', getCampainController.getCampaigns); 
router.get('/get-click', getCampainController.Clicks); 
router.get('/track-conversion', getCampainController.trackConversion); 


//coupon feedback

router.post("/feedback", verifyToken,submitFeedback);
router.get("/:id/feedback", getFeedbackStats);
router.get("/topStores",getTopStores);




router.post('/applyCoupon', userController.applyCoupon);

router.post('/check-user-exist', userController.checkUserExists);  
router.post('/signup', userController.signup);
router.post('/login', userController.login);  
router.post('/login-otp', userController.checkUserExistence);  
router.post('/login-otp-exists', userController.checkUserExistenceOTp);  

router.post('/forget-password', userController.forgotPassword);  

router.post("/updateimage", upload.single("image"), updateUserImage);
router.get("/getimage/:user_id", getCampainController.getUserImage);





// Route to chnage details for a specific user
router.get("/users-details/:id",verifyToken, userController.getUsersDetails);

router.post("/users-change/:userId",verifyToken, userController.changePassword);

// Route to add subscribe details for user
router.post("/subscribe-details",verifyToken, userController.addsubscribeDetails);
//add coupons 
router.post("/add-coupon", userController.addCouponDetails);
// Route to get all coupons
router.get("/all-coupon", getAllCoupons);   
router.get("/all-couponss/:categoryName", userController.getAllCategoryCoupons);
router.get("/get-user-bank/:user_id", getUserFinancialDetails); 


// Route to get a specific coupon by slug

router.get("/single-coupon/:slug", userController.getCouponBySlug);


// Route to get transection history for a specific user
router.get("/tdetails/:userId", userController.getTransactions);


// Route to add upi details
router.post("/upi-details", userController.upsertUpiDetails);   
// Route to update upi details
// router.put("/upi-details/:userId", userController.updateUpiDetails);  
// Route to get upi details for a specific user
router.get("/upi-details/:userId", userController.getUpiDetails);


// Route to add withdrew details
router.post("/add-withdrow-details", userController.createWithdrawal);   
router.post("/update-withdrow-details", withdrawController.updateWithdrawalStatus);   



router.post("/update-wallet",  userController.updateWallet);

//route get withdrew details 
router.get("/get-withdrow", userController.getAllWithdrawRequests);   

// Route to add bank details
router.post("/bank-details", userController.addBankDetails); 

// Route to get bank details for a specific user
router.get("/bank-details/:userId", userController.getBankDetails);

// Route to update bank details
router.put("/bank-details/:userId", userController.updateBankDetails);
//Route to create admin
router.post('/create-subadmin', createAdmin);

router.post('/adminlogin',loginAdmin);


// router.post('/register', authMiddleware(['create_admin']), createAdmin);
// router.post('/login', loginAdmin);
// router.get('/admins', authMiddleware(['view_admins']), getAllAdmins);


module.exports = router;
