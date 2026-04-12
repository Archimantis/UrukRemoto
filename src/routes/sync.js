const router  = require('express').Router();
const { body, query, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { push, pull, fullSync, status } = require('../controllers/syncController');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error('Validação'); err.type = 'validation'; err.errors = errors.array();
    return next(err);
  }
  next();
};

router.use(authenticate);

// POST /sync/push — Android → Servidor
router.post('/push', [
  body('device_id').notEmpty().withMessage('device_id obrigatório.'),
  body('records').isArray({ min: 1 }).withMessage('records deve ser array não vazio.'),
  body('records.*.table').notEmpty(),
  body('records.*.updated_at').notEmpty(),
], validate, push);

// GET /sync/pull?since=ISO[&tables=t1,t2]
router.get('/pull', [
  query('since').notEmpty().withMessage('since obrigatório.'),
], validate, pull);

// GET /sync/full[?tables=t1,t2&page=1&limit=500]
router.get('/full', fullSync);

// GET /sync/status — contagem de registros por tabela
router.get('/status', status);

module.exports = router;
