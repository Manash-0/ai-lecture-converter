// middleware/authorize.js
function authorize(roles = []) {
  // roles can be a single role string or an array
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      // For admin pages, redirect. For API, send error.
      if (req.originalUrl.startsWith('/admin')) {
        return res.status(403).redirect("/login");
      }
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
}

module.exports = authorize;
