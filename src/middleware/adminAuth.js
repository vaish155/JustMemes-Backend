const crypto = require('crypto');

function adminAuth(req, res, next) {
  const expected = process.env.ADMIN_PWD;

  if (!expected) {
    return res.status(500).json({ error: 'ADMIN_PWD is not configured on the server.' });
  }

  const supplied = req.get('x-admin-pwd') || req.get('x-admin-password');

  if (!supplied) {
    return res.status(401).json({ error: 'Unauthorized. Admin password required.' });
  }

  const a = crypto.createHash('sha256').update(String(supplied)).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();

  if (!crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Unauthorized. Invalid admin password.' });
  }

  next();
}

module.exports = adminAuth;
