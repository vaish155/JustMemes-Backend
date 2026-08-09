const express = require('express');
const {
  handleCreatePaymentOrder,
  handleVerifyPayment,
} = require('../controllers/paymentController');
const {
  handleCreatePhonePeOrder,
  handleVerifyPhonePePayment,
  handlePhonePeCallback,
} = require('../controllers/phonepeController');

const router = express.Router();

// Razorpay routes
router.post('/create-order', handleCreatePaymentOrder);
router.post('/verify', handleVerifyPayment);

// PhonePe routes
router.post('/phonepe/create-order', handleCreatePhonePeOrder);
router.post('/phonepe/verify', handleVerifyPhonePePayment);
router.post('/phonepe/callback', handlePhonePeCallback);

module.exports = router;

