const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const auth  = req.headers['authorization'];
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Token não fornecido.' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
    res.status(401).json({ error: 'Token inválido ou expirado.', code });
  }
};

module.exports = { authenticate };
