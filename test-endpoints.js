const crypto = require('crypto');

const { startServer } = require('./server');

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });

  const text = await response.text();
  let data = text;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    data = text;
  }

  return {
    status: response.status,
    ok: response.ok,
    data
  };
}

async function runTests() {
  const server = startServer();

  await new Promise((resolve, reject) => {
    server.once('ready', resolve);
    server.once('error', reject);
  });

  const address = server.address();
  let host = process.env.HOST || 'localhost';

  const baseUrl = `http://${host}:${address.port}`;

  const results = [];

  const runTest = async (name, fn) => {
    try {
      await fn();
      console.log(`✓ ${name}`);
      results.push({ name, status: 'pass' });
    } catch (error) {
      console.error(`✗ ${name}`);
      console.error(error.message);
      results.push({ name, status: 'fail', error: error.message });
    }
  };

  try {
    await runTest('GET /ping', async () => {
      const response = await request(baseUrl, '/ping');
      assertCondition(response.status === 200, `Expected 200 but received ${response.status}`);
      assertCondition(response.data && response.data.ok === true, 'Expected ping response to contain ok: true');
    });

    let createdProduct = null;
    let createdOrder = null;

    await runTest('GET /products', async () => {
      const response = await request(baseUrl, '/products');
      assertCondition(response.status === 200, `Expected 200 but received ${response.status}`);
      assertCondition(Array.isArray(response.data), 'Expected /products to return an array');
    });

    await runTest('POST /products', async () => {
      const response = await request(baseUrl, '/products', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Tee',
          description: 'Created by endpoint test script',
          price: 349,
          imageUrl: 'https://example.com/test-tee.jpg',
          stock: 10,
          size: ['xs', 's', 'm', 'l', 'xl']
        })
      });

      assertCondition(response.status === 201, `Expected 201 but received ${response.status}`);
      assertCondition(response.data && response.data.id, 'Expected created product to include an id');
      assertCondition(Array.isArray(response.data.size), 'Expected created product to include an array of available sizes');
      assertCondition(response.data.size.includes('m'), 'Expected created product to include the size m');
      createdProduct = response.data;
    });

    await runTest('GET /products/:id', async () => {
      const response = await request(baseUrl, `/products/${createdProduct.id}`);
      assertCondition(response.status === 200, `Expected 200 but received ${response.status}`);
      assertCondition(response.data && response.data.id === createdProduct.id, 'Returned product does not match created id');
    });

    await runTest('PUT /products/:id', async () => {
      const response = await request(baseUrl, `/products/${createdProduct.id}`, {
        method: 'PUT',
        body: JSON.stringify({ price: 399 })
      });
      assertCondition(response.status === 200, `Expected 200 but received ${response.status}`);
      assertCondition(response.data && response.data.price === 399, 'Expected product price to be updated');
    });

    await runTest('POST /checkout', async () => {
      const response = await request(baseUrl, '/checkout', {
        method: 'POST',
        body: JSON.stringify({
          customerName: 'Test Customer',
          contact: '9876543210',
          email: 'test@example.com',
          address: 'Hostel Block A',
          roomNumber: '101',
          hostelName: 'Sunrise Hostel',
          items: [{ productId: createdProduct.id, quantity: 1, size: 'm' }]
        })
      });

      assertCondition(response.status === 201, `Expected 201 but received ${response.status}`);
      assertCondition(response.data && response.data.success === true, 'Expected checkout to succeed');
      assertCondition(response.data.order && response.data.order.items?.[0]?.size === 'm', 'Expected checkout to store the selected size');
      createdOrder = response.data.order;
    });

    await runTest('GET /orders', async () => {
      const response = await request(baseUrl, '/orders');
      assertCondition(response.status === 200, `Expected 200 but received ${response.status}`);
      assertCondition(Array.isArray(response.data), 'Expected /orders to return an array');
    });

    await runTest('POST /payments/create-order', async () => {
      const response = await request(baseUrl, '/payments/create-order', {
        method: 'POST',
        body: JSON.stringify({ orderId: createdOrder.id, amount: 5000 })
      });
      assertCondition(response.status === 200, `Expected 200 but received ${response.status}`);
      assertCondition(response.data && response.data.success === true, 'Expected payment order creation to succeed');
      assertCondition(response.data.razorpay && response.data.razorpay.id, 'Expected Razorpay payload to contain an id');
    });

    await runTest('POST /payments/verify', async () => {
      const verifyResponse = await request(baseUrl, '/payments/verify', {
        method: 'POST',
        body: JSON.stringify({
          orderId: createdOrder.id,
          razorpay_order_id: createdOrder.id,
          razorpay_payment_id: 'pay_test_123',
          razorpay_signature: crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'test_secret')
            .update(`${createdOrder.id}|pay_test_123`)
            .digest('hex')
        })
      });
      assertCondition(verifyResponse.status === 200, `Expected 200 but received ${verifyResponse.status}`);
      assertCondition(verifyResponse.data && verifyResponse.data.valid === true, 'Expected payment verification to succeed');
    });

    await runTest('DELETE /products/:id', async () => {
      const response = await request(baseUrl, `/products/${createdProduct.id}`, {
        method: 'DELETE'
      });
      assertCondition(response.status === 200, `Expected 200 but received ${response.status}`);
      assertCondition(response.data && response.data.success === true, 'Expected product delete to succeed');
    });
  } finally {
    server.close();
  }

  const failed = results.filter((result) => result.status === 'fail');
  console.log('\nSummary:');
  console.log(`Passed: ${results.length - failed.length}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

runTests().catch((error) => {
  console.error('Endpoint test runner crashed');
  console.error(error);
  process.exit(1);
});
