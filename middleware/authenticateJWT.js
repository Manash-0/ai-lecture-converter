const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "your-strong-secret-key";

function authenticateJWT(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    // For admin pages, redirect to login. For API, send error.
    if (req.originalUrl.startsWith('/admin')) {
      return res.status(401).redirect("/login");
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }

  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) {
        if (req.originalUrl.startsWith('/admin')) {
            return res.status(403).redirect("/login");
        }
        return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = decoded;
    next();
  });
}

module.exports = authenticateJWT;
