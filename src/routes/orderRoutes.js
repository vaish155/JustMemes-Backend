const express = require('express');
const {
  handleCheckout,
  handleListOrders,
  handleGetOrderById,
} = require('../controllers/orderController');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

router.post('/checkout', handleCheckout);
router.get('/orders', adminAuth, handleListOrders);
router.get('/orders/:id', handleGetOrderById);

module.exports = router;
