const crypto = require('crypto');

function timingSafeEqualStr(a, b) {
  const x = Buffer.from(String(a), 'utf8');
  const y = Buffer.from(String(b), 'utf8');
  if (x.length !== y.length) return false;
  try {
    return crypto.timingSafeEqual(x, y);
  } catch {
    return false;
  }
}

// Admin-only middleware.
// - If ADMIN_API_TOKEN is set in env: require header x-admin-api-token to match (production).
// - Otherwise: accept x-user-role: admin (local dev).
// - req.user.role === 'admin' still works if you add JWT auth later.
module.exports = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();

  const expected = (process.env.ADMIN_API_TOKEN || '').trim();
  const sent = (req.headers['x-admin-api-token'] || '').trim();

  if (expected) {
    if (sent && timingSafeEqualStr(sent, expected)) return next();
    return res.status(403).json({
      message: 'Admin only — set the same API token in Admin → Settings as ADMIN_API_TOKEN on the server'
    });
  }

  const role = req.headers['x-user-role'];
  if (role === 'admin') return next();

  return res.status(403).json({ message: 'Admin only' });
};

