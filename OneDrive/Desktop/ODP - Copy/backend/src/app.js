const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { doubleCsrf } = require('csrf-csrf');

const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { buildAllowedOrigins, isAllowedOrigin } = require('./utils/corsOrigins');

const app = express();

const allowedOrigins = buildAllowedOrigins(process.env.FRONTEND_URL);

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin, allowedOrigins)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));

app.use(helmet());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// ── CSRF protection ──────────────────────────────────────────────────────
// Uses the "double submit cookie" pattern.
// Frontend must:
//   1. GET /api/auth/csrf-token  → receives { csrfToken }
//   2. Include header x-csrf-token: <token> on all non-GET API requests
const { generateToken: generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.JWT_SECRET,
  cookieName: '__Host-psifi.x-csrf-token',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax'
  },
  size: 64,
  getTokenFromRequest: (req) => req.headers['x-csrf-token']
});

// Expose CSRF token endpoint (GET — safe, no protection needed)
app.get('/api/auth/csrf-token', (req, res) => {
  const token = generateCsrfToken(req, res);
  return res.json({ success: true, csrfToken: token });
});

// Apply CSRF to all mutating API routes (skip GET + HEAD + OPTIONS automatically)
app.use('/api', doubleCsrfProtection);

// ── Rate limiting ────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});
app.use('/api', apiLimiter);

// Tighter limit on auth endpoints to slow brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// ── Health check ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.status(200).json({ success: true, message: 'Server is healthy' }));

// ── API routes ────────────────────────────────────────────────────────────
app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
