require('dotenv').config();
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const syncRoutes = require('./routes/sync');
const { errorHandler } = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300,
  message: { error: 'Muitas requisições. Aguarde 15 minutos.' } }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30,
  message: { error: 'Muitas tentativas. Aguarde 15 minutos.' } });

// ---- Rotas ----
app.get('/health', (_, res) => res.json({
  status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0'
}));

app.use('/auth', authLimiter, authRoutes);
app.use('/sync', syncRoutes);

app.use((req, res) => res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` }));
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n🚀 uruk-api na porta ${PORT} | ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
