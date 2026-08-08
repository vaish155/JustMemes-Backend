const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/ping', (req, res) => {
  res.type('text/plain').send('Working server');
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
