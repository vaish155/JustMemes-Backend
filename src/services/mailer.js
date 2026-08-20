const { Resend } = require('resend');

let resend = null;

function getClient() {
  if (resend) {
    return resend;
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn(
      '[mailer] RESEND_API_KEY not configured — skipping real email delivery.'
    );
    return null;
  }

  resend = new Resend(apiKey);
  return resend;
}

function formatINR(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function buildOrderConfirmHTML(order) {
  const itemsHtml = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${item.productName} (${item.size})</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${formatINR(
            item.price * item.quantity
          )}</td>
        </tr>`
    )
    .join('');

  const frontendUrl = process.env.FRONTEND_URL || 'https://memetheory.in';
  const trackUrl = `${frontendUrl}/trackorder?ref=${encodeURIComponent(order.id)}`;

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#222;">
      <div style="background:#111;color:#fff;padding:20px;text-align:center;">
        <h1 style="margin:0;">Meme Theory</h1>
        <p style="margin:8px 0 0;opacity:.8;">Order Confirmation</p>
      </div>
      <div style="padding:24px;border:1px solid #eee;border-top:none;">
        <p>Hi <strong>${order.customerName}</strong>,</p>
        <p>Thank you for your order! Your payment was successful and your order has been confirmed.</p>
        <p style="background:#f5f5f5;padding:12px;border-radius:6px;">
          <strong>Order ID:</strong> ${order.id}
        </p>
        <table style="width:100%;border-collapse:collapse;margin-top:12px;">
          <tr>
            <th style="padding:8px 12px;border-bottom:2px solid #111;text-align:left;">Item</th>
            <th style="padding:8px 12px;border-bottom:2px solid #111;text-align:center;">Qty</th>
            <th style="padding:8px 12px;border-bottom:2px solid #111;text-align:right;">Amount</th>
          </tr>
          ${itemsHtml}
        </table>
        <p style="text-align:right;font-size:18px;font-weight:bold;margin-top:12px;">
          Total: ${formatINR(order.total)}
        </p>
        <p style="color:#555;font-size:13px;margin-top:20px;">
          Delivery: ${order.hostelName}, Room ${order.roomNumber}, ${order.address}
        </p>
        <p style="color:#555;font-size:13px;margin-top:4px;">
          Estimated delivery: 7-10 business days from order date.
        </p>
        <div style="text-align:center;margin-top:24px;">
          <a href="${trackUrl}" style="display:inline-block;background:#111;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">Track Your Order</a>
        </div>
        <p style="color:#888;font-size:12px;margin-top:24px;">
          For any queries, reply to this email or contact us at support@memetheory.in
        </p>
      </div>
    </div>
  `;
}

function buildOrderConfirmText(order) {
  const lines = order.items.map(
    (item) =>
      `- ${item.productName} (${item.size}) x${item.quantity} = ${formatINR(
        item.price * item.quantity
      )}`
  );

  const frontendUrl = process.env.FRONTEND_URL || 'https://memetheory.in';
  const trackUrl = `${frontendUrl}/trackorder?ref=${encodeURIComponent(order.id)}`;

  return [
    `Hi ${order.customerName},`,
    '',
    'Thank you for your order! Your payment was successful and your order has been confirmed.',
    '',
    `Order ID: ${order.id}`,
    '',
    ...lines,
    '',
    `Total: ${formatINR(order.total)}`,
    '',
    `Delivery: ${order.hostelName}, Room ${order.roomNumber}, ${order.address}`,
    'Estimated delivery: 7-10 business days from order date.',
    '',
    `Track your order: ${trackUrl}`,
    '',
    'For any queries, reply to this email or contact us at support@memetheory.in',
  ].join('\n');
}

async function sendOrderConfirmation(order) {
  const client = getClient();
  if (!client || !order || !order.email) {
    console.warn(`[mailer] Skipping confirmation email for order ${order?.id || 'unknown'}`);
    return false;
  }

  const from = process.env.EMAIL_FROM || 'support@memetheory.in';

  try {
    await client.emails.send({
      from: `Meme Theory <${from}>`,
      to: order.email,
      subject: `Order Confirmed — ${order.id} | Meme Theory`,
      text: buildOrderConfirmText(order),
      html: buildOrderConfirmHTML(order),
    });
    console.log(`[mailer] Confirmation email sent for order ${order.id} to ${order.email}`);
    return true;
  } catch (error) {
    console.error(`[mailer] Failed to send email for order ${order.id}:`, error.message);
    return false;
  }
}

module.exports = { sendOrderConfirmation };
