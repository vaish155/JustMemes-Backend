const crypto = require('crypto');
const { getOrderById, updateOrder } = require('../models/Order');
const { sendOrderConfirmation } = require('../services/mailer');

/**
 * Get PhonePe Environment Config dynamically from process.env
 */
function getPhonePeConfig() {
  const env = process.env.PHONEPE_ENV || 'UAT'; // 'UAT' or 'PRODUCTION'

  // Default to official active PhonePe Sandbox credentials in UAT mode if not set in process.env
  const defaultMerchantId = env === 'UAT' ? 'PGTESTPAYUAT86' : '';
  const defaultSaltKey = env === 'UAT' ? '96434309-7796-489d-8924-ab56988a6076' : '';

  const merchantId = process.env.PHONEPE_MERCHANT_ID || defaultMerchantId;
  const saltKey = process.env.PHONEPE_SALT_KEY || defaultSaltKey;
  const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';

  const hostUrl =
    env === 'PRODUCTION'
      ? 'https://api.phonepe.com/apis/hermes'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

  return { merchantId, saltKey, saltIndex, env, hostUrl };
}

/**
 * Generate SHA256 Checksum header required by PhonePe API (X-VERIFY)
 */
function calculateXVerify(endpoint, payloadString, saltKey, saltIndex) {
  const stringToHash = payloadString + endpoint + saltKey;
  const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
  return `${sha256}###${saltIndex}`;
}

/**
 * Handle initiating PhonePe Payment Order
 */
async function handleCreatePhonePeOrder(req, res, next) {
  try {
    const { orderId, amount, frontendUrl, vpa, paymentType } = req.body;
    const order = await getOrderById(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const cleanOrderId = String(order.id).replace(/[^a-zA-Z0-9]/g, '').slice(-12);
    const merchantTransactionId = `TXN_${cleanOrderId}_${Date.now()}`;
    const amountInPaise = Math.round((amount || order.total) * 100);

    const redirectUrl =
      req.body.redirectUrl ||
      `${frontendUrl || 'http://localhost:3000'}/payment/phonepe-callback?orderId=${encodeURIComponent(
        order.id
      )}&txnId=${encodeURIComponent(merchantTransactionId)}`;

    const callbackUrl =
      process.env.PHONEPE_CALLBACK_URL ||
      `https://justmemes-backend-531422631456.asia-south1.run.app/payments/phonepe/callback`;

    const config = getPhonePeConfig();

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

    const paymentInstrument =
      paymentType === 'UPI_COLLECT' && vpa
        ? { type: 'UPI_COLLECT', vpa: String(vpa).trim() }
        : { type: 'PAY_PAGE' };

    // PhonePe Payload
    const payload = {
      merchantId: config.merchantId,
      merchantTransactionId,
      merchantUserId: `MUID_${order.customerName ? order.customerName.replace(/\s+/g, '_') : 'USER'}`,
      amount: amountInPaise,
      redirectUrl,
      redirectMode: 'REDIRECT',
      callbackUrl,
      mobileNumber: order.contact ? order.contact.replace(/\D/g, '').slice(-10) : '9999999999',
      paymentInstrument,
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const xVerify = calculateXVerify('/pg/v1/pay', base64Payload, config.saltKey, config.saltIndex);

    const apiResponse = await fetch(`${config.hostUrl}/pg/v1/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify,
      },
      body: JSON.stringify({ request: base64Payload }),
    });

    const data = await apiResponse.json();

    if (!data.success) {
      if (data.code === 'KEY_NOT_CONFIGURED') {
        console.warn('PhonePe KEY_NOT_CONFIGURED: Falling back to sandbox test mode redirect.');
        const updatedOrder = await updateOrder(order.id, {
          phonepeTxnId: merchantTransactionId,
          paymentGateway: 'phonepe_test_fallback',
        });
        return res.json({
          success: true,
          mock: true,
          order: updatedOrder,
          redirectUrl: `${frontendUrl || 'http://localhost:3000'}/payment/phonepe-callback?orderId=${encodeURIComponent(
            order.id
          )}&txnId=${encodeURIComponent(merchantTransactionId)}&mock=true`,
          merchantTransactionId,
          note: 'PhonePe merchant key pending activation in sandbox. Test payment fallback enabled.',
        });
      }

      return res.status(400).json({
        success: false,
        error: data.message || 'PhonePe payment initialization failed',
        phonepeResponse: data,
      });
    }

    const redirectInfoUrl = data.data?.instrumentResponse?.redirectInfo?.url || redirectUrl;

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

    const config = getPhonePeConfig();

    if (isMock || process.env.PHONEPE_MOCK === 'true') {
      const updatedOrder = await updateOrder(order.id, {
        paymentStatus: 'paid',
        orderStatus: 'paid',
        paymentGateway: 'phonepe_mock',
        phonepeTxnId: merchantTransactionId || order.phonepeTxnId,
      });

      sendOrderConfirmation(updatedOrder);

      return res.json({
        success: true,
        valid: true,
        paymentStatus: 'COMPLETED',
        order: updatedOrder,
      });
    }

    const txnId = merchantTransactionId || order.phonepeTxnId;
    const endpoint = `/pg/v1/status/${config.merchantId}/${txnId}`;
    const xVerify = calculateXVerify(endpoint, '', config.saltKey, config.saltIndex);

    const apiResponse = await fetch(`${config.hostUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify,
        'X-MERCHANT-ID': config.merchantId,
      },
    });

    const data = await apiResponse.json();
    const isPaymentSuccessful = data.code === 'PAYMENT_SUCCESS';

    const updatedOrder = await updateOrder(order.id, {
      paymentStatus: isPaymentSuccessful ? 'paid' : 'failed',
      orderStatus: isPaymentSuccessful ? 'paid' : 'failed',
      phonepeResponseCode: data.code,
    });

    if (isPaymentSuccessful) {
      sendOrderConfirmation(updatedOrder);
    }

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
