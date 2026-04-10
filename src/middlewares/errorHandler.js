module.exports = (err, req, res, next) => {
  // eslint-disable-next-line no-console
  if (process.env.NODE_ENV !== 'test') console.error(err);

  // Basic mapping for common error types
  if (err && err.name === 'ValidationError') {
    err.statusCode = 400;
  }

  const statusCode = err.statusCode || err.status || 500;
  // Default handler hid all 500 messages — surface real errors in dev / when message exists
  const message =
    statusCode === 500 && process.env.NODE_ENV === 'production' && !err.expose
      ? 'Internal Server Error'
      : err.message || (statusCode === 500 ? 'Internal Server Error' : 'Request failed');

  // Mongo duplicate key error
  if (err && err.code === 11000) {
    return res.status(409).json({
      message: 'Duplicate value violates unique constraint'
    });
  }

  return res.status(statusCode).json({
    message,
    ...(err.paytabsHint && { hint: err.paytabsHint }),
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

