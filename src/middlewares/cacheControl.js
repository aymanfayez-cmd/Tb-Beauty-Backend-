function cacheControl(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  return function cacheControlMiddleware(_req, res, next) {
    // CDN/proxy-friendly caching; keep it short to avoid stale storefront.
    res.setHeader('Cache-Control', `public, max-age=${s}, stale-while-revalidate=${Math.min(300, s * 2)}`);
    next();
  };
}

module.exports = { cacheControl };

