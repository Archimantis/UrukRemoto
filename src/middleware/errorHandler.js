const errorHandler = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, err.message);

  if (err.type === 'validation') {
    return res.status(422).json({ error: 'Dados inválidos.', details: err.errors });
  }

  // Erros PostgreSQL
  switch (err.code) {
    case '23505': return res.status(409).json({ error: 'Registro duplicado.', detail: err.detail });
    case '23503': return res.status(409).json({ error: 'Referência inválida.', detail: err.detail });
    case '23502': return res.status(422).json({ error: 'Campo obrigatório ausente.', detail: err.detail });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Erro interno.' : err.message,
  });
};

module.exports = { errorHandler };
