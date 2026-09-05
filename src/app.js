require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const db = require('./models');
const setupSchedules = require('./services/scheduler');
const { speechCatalog } = require('./services/speech');
const { PHRASES } = require('./utils/phrases');
const { getParashaName } = require('./utils/hebrew-date');
const ensureAdmin = require('./utils/ensure-admin');
const ensureColumns = require('./utils/ensure-columns');
const { DataTypes } = require('sequelize');

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

// Serve the built admin frontend (frontend/dist), with SPA fallback for
// client-side routing on any non-API, non-file path.
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get(/^(?!\/api|\/health).*/, (req, res, next) => {
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) next();
  });
});

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

    // Additive column migrations that sync() alone won't apply in
    // production (see ensure-columns.js for why), run before sync so a
    // fresh deploy always has them.
    await ensureColumns(db.sequelize, 'completions', {
      hebrew_month: { type: DataTypes.STRING, allowNull: true },
      hebrew_year: { type: DataTypes.INTEGER, allowNull: true },
    });
    await ensureColumns(db.sequelize, 'activities', {
      hebrew_year: { type: DataTypes.INTEGER, allowNull: true },
    });
    await ensureColumns(db.sequelize, 'users', {
      password: { type: DataTypes.STRING, allowNull: true },
      grade: { type: DataTypes.STRING, allowNull: true },
    });

    // Sync database (use alter: true in production with caution)
    await db.sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('✅ Database synced');

    await ensureAdmin();

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
    speechCatalog.warm(PHRASES).then(async ({ ready, failed }) => {
      console.log(`🔊 Speech catalog warmed: ${ready} ready, ${failed} failed`);
      // This week's parasha name changes weekly, so it isn't in the fixed
      // PHRASES catalog — prepare it too, so the first caller of the week
      // doesn't hit silence while it synthesizes on demand.
      const parasha = await getParashaName();
      if (parasha) await speechCatalog.ensure(parasha);
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
