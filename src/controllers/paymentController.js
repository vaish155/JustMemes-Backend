const crypto = require('crypto');
const Razorpay = require('razorpay');
const { getOrderById, updateOrder } = require('../models/Order');

function createRazorpayInstance() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return null;
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

async function createRazorpayOrderPayload(order, amount) {
  const instance = createRazorpayInstance();
  if (!instance) {
    return {
      mock: true,
      id: `mock_order_${Date.now()}`,
      amount,
      currency: 'INR',
      receipt: order.id,
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock',
    };
  }

  return instance.orders.create({
    amount,
    currency: 'INR',
    receipt: order.id,
  });
}

async function handleCreatePaymentOrder(req, res, next) {
  try {
    const { orderId, amount } = req.body;
    const order = await getOrderById(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const payload = await createRazorpayOrderPayload(
      order,
      amount || Math.round(order.total * 100)
    );
    const updatedOrder = await updateOrder(order.id, { razorpayOrderId: payload.id });

    res.json({ success: true, order: updatedOrder, razorpay: payload });
  } catch (error) {
    next(error);
  }
}

async function handleVerifyPayment(req, res, next) {
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const order = await getOrderById(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'test_secret')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;
    const updatedOrder = await updateOrder(order.id, {
      paymentStatus: isValid ? 'paid' : 'failed',
      orderStatus: isValid ? 'paid' : 'failed',
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    res.json({ success: true, valid: isValid, order: updatedOrder });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  handleCreatePaymentOrder,
  handleVerifyPayment,
};
