const express = require('express');
const {
  handleCreatePhonePeOrder,
  handleVerifyPhonePePayment,
  handlePhonePeCallback,
} = require('../controllers/phonepeController');

const router = express.Router();

// PhonePe routes
router.post('/create-order', handleCreatePhonePeOrder);
router.post('/verify', handleVerifyPhonePePayment);
router.post('/phonepe/create-order', handleCreatePhonePeOrder);
router.post('/phonepe/verify', handleVerifyPhonePePayment);
router.post('/phonepe/callback', handlePhonePeCallback);

module.exports = router;
