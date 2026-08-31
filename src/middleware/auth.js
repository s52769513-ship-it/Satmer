const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'secret-key', (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Token invalid or expired' });
      }
      req.user = user;
      next();
    });
  } catch (error) {
    res.status(500).json({ error: 'Authentication error' });
  }
};

const authorizeAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = { authenticateToken, authorizeAdmin };
