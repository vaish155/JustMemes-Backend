const crypto = require('crypto');
const { getOrderById, updateOrder } = require('../models/Order');

// PhonePe Config
const MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID || 'M222AV357KIE0_2608092254';
const SALT_KEY = process.env.PHONEPE_SALT_KEY || 'MjJkYWM2MmQtYjE2OC00OGRkLTk3YmEtMWZmZmExYjM2Y2Zh';
const SALT_INDEX = process.env.PHONEPE_SALT_INDEX || '1';
const ENV = process.env.PHONEPE_ENV || 'UAT'; // 'UAT' or 'PRODUCTION'

const HOST_URL =
  ENV === 'UAT'
    ? 'https://api-preprod.phonepe.com/apis/pg-sandbox'
    : 'https://api.phonepe.com/apis/hermes';


/**
 * Generate SHA256 Checksum header required by PhonePe API (X-VERIFY)
 */
function calculateXVerify(endpoint, payloadString) {
  const stringToHash = payloadString + endpoint + SALT_KEY;
  const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
  return `${sha256}###${SALT_INDEX}`;
}

/**
 * Handle initiating PhonePe Payment Order
 */
async function handleCreatePhonePeOrder(req, res, next) {
  try {
    const { orderId, amount, frontendUrl } = req.body;
    const order = await getOrderById(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const merchantTransactionId = `TXN_${order.id}_${Date.now()}`;
    const amountInPaise = Math.round((amount || order.total) * 100);

    const redirectUrl =
      req.body.redirectUrl ||
      `${frontendUrl || 'http://localhost:3000'}/payment/phonepe-callback?orderId=${encodeURIComponent(
        order.id
      )}&txnId=${encodeURIComponent(merchantTransactionId)}`;

    const callbackUrl =
      process.env.PHONEPE_CALLBACK_URL ||
      `https://justmemes-backend-531422631456.asia-south1.run.app/payments/phonepe/callback`;

    // Check if mock mode is explicitly requested
    const isMock = process.env.PHONEPE_MOCK === 'true';

    if (isMock) {
      // Mock PhonePe Response for seamless local testing
      const updatedOrder = await updateOrder(order.id, {
        phonepeTxnId: merchantTransactionId,
        paymentGateway: 'phonepe_mock',
      });

      return res.json({
        success: true,
        mock: true,
        order: updatedOrder,
        redirectUrl: `${frontendUrl || 'http://localhost:3000'}/payment/phonepe-callback?orderId=${encodeURIComponent(
          order.id
        )}&txnId=${encodeURIComponent(merchantTransactionId)}&mock=true`,
        merchantTransactionId,
      });
    }

    // PhonePe Payload
    const payload = {
      merchantId: MERCHANT_ID,
      merchantTransactionId,
      merchantUserId: `MUID_${order.customerName ? order.customerName.replace(/\s+/g, '_') : 'USER'}`,
      amount: amountInPaise,
      redirectUrl,
      redirectMode: 'REDIRECT',
      callbackUrl,
      mobileNumber: order.contact ? order.contact.replace(/\D/g, '').slice(-10) : '9999999999',
      paymentInstrument: {
        type: 'PAY_PAGE',
      },
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const xVerify = calculateXVerify('/pg/v1/pay', base64Payload);

    const apiResponse = await fetch(`${HOST_URL}/pg/v1/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify,
      },
      body: JSON.stringify({ request: base64Payload }),
    });

    const data = await apiResponse.json();

    if (!data.success) {
      return res.status(400).json({
        success: false,
        error: data.message || 'PhonePe payment initialization failed',
        phonepeResponse: data,
      });
    }

    const redirectInfoUrl = data.data?.instrumentResponse?.redirectInfo?.url;

    await updateOrder(order.id, {
      phonepeTxnId: merchantTransactionId,
      paymentGateway: 'phonepe',
    });

    res.json({
      success: true,
      mock: false,
      redirectUrl: redirectInfoUrl,
      merchantTransactionId,
      phonepeData: data,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle PhonePe Payment Status Verification
 */
async function handleVerifyPhonePePayment(req, res, next) {
  try {
    const { orderId, merchantTransactionId, isMock } = req.body;
    const order = await getOrderById(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (isMock || process.env.PHONEPE_MOCK === 'true') {
      const updatedOrder = await updateOrder(order.id, {
        paymentStatus: 'paid',
        orderStatus: 'paid',
        paymentGateway: 'phonepe_mock',
        phonepeTxnId: merchantTransactionId || order.phonepeTxnId,
      });

      return res.json({
        success: true,
        valid: true,
        paymentStatus: 'COMPLETED',
        order: updatedOrder,
      });
    }

    const txnId = merchantTransactionId || order.phonepeTxnId;
    const endpoint = `/pg/v1/status/${MERCHANT_ID}/${txnId}`;
    const xVerify = calculateXVerify(endpoint, '');

    const apiResponse = await fetch(`${HOST_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify,
        'X-MERCHANT-ID': MERCHANT_ID,
      },
    });

    const data = await apiResponse.json();
    const isPaymentSuccessful = data.code === 'PAYMENT_SUCCESS';

    const updatedOrder = await updateOrder(order.id, {
      paymentStatus: isPaymentSuccessful ? 'paid' : 'failed',
      orderStatus: isPaymentSuccessful ? 'paid' : 'failed',
      phonepeResponseCode: data.code,
    });

    res.json({
      success: isPaymentSuccessful,
      valid: isPaymentSuccessful,
      paymentStatus: data.code,
      order: updatedOrder,
      phonepeData: data,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handle PhonePe Server-to-Server Callback Webhook
 */
async function handlePhonePeCallback(req, res, next) {
  try {
    const { response } = req.body;
    if (response) {
      const decoded = JSON.parse(Buffer.from(response, 'base64').toString('utf-8'));
      const merchantTransactionId = decoded.data?.merchantTransactionId;
      const isSuccess = decoded.code === 'PAYMENT_SUCCESS';

      // Find order by phonepeTxnId if stored
      console.log(`PhonePe Callback received for TXN: ${merchantTransactionId}, Status: ${decoded.code}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('PhonePe Callback Error:', error);
    res.status(200).json({ success: false });
  }
}

module.exports = {
  handleCreatePhonePeOrder,
  handleVerifyPhonePePayment,
  handlePhonePeCallback,
};
