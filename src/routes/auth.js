const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { register, login, refresh, logout } = require('../controllers/authController');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error('Validação'); err.type = 'validation'; err.errors = errors.array();
    return next(err);
  }
  next();
};

router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('nome').optional().trim(),
  body('device_id').optional().trim(),
], validate, register);

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  body('device_id').optional().trim(),
], validate, login);

router.post('/refresh', refresh);
router.post('/logout',  logout);

module.exports = router;
