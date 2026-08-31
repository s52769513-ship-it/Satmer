require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./models');
const setupSchedules = require('./services/scheduler');
const { speechCatalog } = require('./services/speech');
const { PHRASES } = require('./utils/phrases');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const query = { ...req.query };
  if (query.token) query.token = '***';
  console.log(`[${new Date().toISOString()}] --> ${req.method} ${req.path} query=${JSON.stringify(query)}`);

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    console.log(`[${new Date().toISOString()}] <-- ${req.method} ${req.path} ${res.statusCode} (${Date.now() - start}ms) body=${JSON.stringify(body)}`);
    return originalJson(body);
  };

  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ivr', require('./routes/ivr'));
app.use('/api/users', require('./routes/users'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/completions', require('./routes/completions'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/pbx', require('./routes/pbx'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Database sync and server start
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Database connected');

    // Sync database (use alter: true in production with caution)
    await db.sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('✅ Database synced');

    // Setup scheduled jobs
    setupSchedules();
    console.log('✅ Scheduled jobs initialized');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // Fire-and-forget: synthesize + upload the fixed prompt catalog to
    // Technoline so the phone line has real audio ready. Doesn't block
    // startup — a caller before this finishes just gets silence for a
    // still-unready prompt, same as before this existed.
    speechCatalog.warm(PHRASES).then(({ ready, failed }) => {
      console.log(`🔊 Speech catalog warmed: ${ready} ready, ${failed} failed`);
    }).catch((error) => {
      console.error('❌ Speech catalog warm-up failed:', error.message);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
