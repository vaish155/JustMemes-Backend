const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0';

app.get('/ping', (_req, res) => {
  res.status(200).json({
    ok: true,
    message: 'pong',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/', (_req, res) => {
  res.send('JustMemes server is running');
});

app.listen(port, host, () => {
  console.log(`Server running on http://${host}:${port}`);
});
