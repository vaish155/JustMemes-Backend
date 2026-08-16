const express = require('express');
const {
  handleCreatePhonePeOrder,
  handleVerifyPhonePePayment,
  handlePhonePeCallback,
} = require('../controllers/phonepeController');
const {
  handleCreateRazorpayOrder,
  handleVerifyRazorpayPayment,
} = require('../controllers/razorpayController');

const router = express.Router();

// PhonePe routes
router.post('/create-order', handleCreatePhonePeOrder);
router.post('/verify', handleVerifyPhonePePayment);
router.post('/phonepe/create-order', handleCreatePhonePeOrder);
router.post('/phonepe/verify', handleVerifyPhonePePayment);
router.post('/phonepe/callback', handlePhonePeCallback);

// Razorpay routes
router.post('/razorpay/create-order', handleCreateRazorpayOrder);
router.post('/razorpay/verify', handleVerifyRazorpayPayment);

module.exports = router;
