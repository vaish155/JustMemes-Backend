const crypto = require('crypto');
const Razorpay = require('razorpay');
const { getOrderById, updateOrder } = require('../models/Order');

function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    const error = new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured');
    error.status = 500;
    throw error;
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

async function handleCreateRazorpayOrder(req, res, next) {
  try {
    const { orderId } = req.body;
    const order = await getOrderById(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const amountInPaise = Math.round((order.total || 0) * 100);

    const razorpay = getRazorpayInstance();
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_${String(order.id).replace(/[^a-zA-Z0-9]/g, '').slice(-12)}`,
      notes: { orderId: order.id },
    });

    await updateOrder(order.id, {
      razorpayOrderId: razorpayOrder.id,
      paymentGateway: 'razorpay',
    });

    res.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: amountInPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      order,
    });
  } catch (error) {
    next(error);
  }
}

async function handleVerifyRazorpayPayment(req, res, next) {
  try {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const order = await getOrderById(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.status(500).json({ error: 'RAZORPAY_KEY_SECRET is not configured' });
    }

    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      await updateOrder(order.id, {
        paymentStatus: 'failed',
        orderStatus: 'failed',
      });
      return res.status(400).json({
        success: false,
        valid: false,
        error: 'Payment signature verification failed',
      });
    }

    const updatedOrder = await updateOrder(order.id, {
      paymentStatus: 'paid',
      orderStatus: 'paid',
      paymentGateway: 'razorpay',
      razorpayPaymentId,
      razorpayOrderId,
    });

    res.json({
      success: true,
      valid: true,
      paymentStatus: 'paid',
      order: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleCreateRazorpayOrder,
  handleVerifyRazorpayPayment,
};
