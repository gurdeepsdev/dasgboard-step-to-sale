const express = require('express');
const userController = require('../controllers/userController');

const router = express.Router();

router.get('/', userController.getHelloWorld);
router.get('/users', userController.getUsers);


module.exports = router;
