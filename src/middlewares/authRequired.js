const jwt = require('jsonwebtoken');

module.exports = function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = header.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ message: 'Server auth is not configured' });
  }
  try {
    const payload = jwt.verify(token, secret);
    const sub = payload.sub || payload.id;
    if (!sub) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    req.user = { id: String(sub) };
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
