// middleware/authenticateJWT.js
const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "your-strong-secret-key";

function authenticateJWT(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).redirect("/login");
  }

  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.status(403).redirect("/login");
    req.user = decoded;
    next();
  });
}

module.exports = authenticateJWT;