const express = require('express');
const {
  handleCreatePaymentOrder,
  handleVerifyPayment,
} = require('../controllers/paymentController');

const router = express.Router();

router.post('/create-order', handleCreatePaymentOrder);
router.post('/verify', handleVerifyPayment);

module.exports = router;
