const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const { connectToDatabase } = require('./src/config/db');
const productRoutes = require('./src/routes/productRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';

// 1. Core Middlewares
app.use(cors());
app.use(express.json());

// 2. Health check & status routes
app.get('/ping', (_req, res) => {
  res.status(200).json({
    ok: true,
    message: 'pong',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (_req, res) => {
  res.send('JustMemes ecommerce backend is running');
});

// 3. API Module Routes
app.use('/products', productRoutes);
app.use('/', orderRoutes);
app.use('/payments', paymentRoutes);

// 4. Centralized Error Handler
app.use(errorHandler);

// 5. Server Startup
function startServer() {
  const server = app.listen(port, host, async () => {
    await connectToDatabase();
    server.emit('ready');
    console.log(`Server running on http://${host}:${port}`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
