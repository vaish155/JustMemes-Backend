const express = require('express');
const {
  handleCheckout,
  handleListOrders,
  handleGetOrderById,
} = require('../controllers/orderController');

const router = express.Router();

router.post('/checkout', handleCheckout);
router.get('/orders', handleListOrders);
router.get('/orders/:id', handleGetOrderById);

module.exports = router;
