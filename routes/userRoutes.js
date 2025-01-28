const express = require('express');
const userController = require('../controllers/userController');
const verifyToken = require('../middlewares/verifyToken'); // Middleware path


const router = express.Router();

router.get('/', userController.getHelloWorld);
// router.get('/users', userController.getUsers);
router.get('/users', verifyToken, userController.getUsers);

router.post('/signup', userController.signup);
router.post('/login', userController.login);


module.exports = router;
