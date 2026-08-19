const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    console.warn(
      '[mailer] EMAIL_USER / EMAIL_PASS not configured — skipping real email delivery.'
    );
    return null;
  }

  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  return transporter;
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
        <p style="color:#888;font-size:12px;">
          For any queries, reply to this email or contact us at support@justmemes.in
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
  ].join('\n');
}

async function sendOrderConfirmation(order) {
  const t = getTransporter();
  if (!t || !order || !order.email) {
    console.warn(`[mailer] Skipping confirmation email for order ${order?.id || 'unknown'}`);
    return false;
  }

  const from = process.env.EMAIL_USER;

  try {
    await t.sendMail({
      from: `"Meme Theory" <${from}>`,
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