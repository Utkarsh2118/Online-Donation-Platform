const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

const envFrontendOrigin = process.env.FRONTEND_URL;
const allowedOrigins = new Set([
	envFrontendOrigin,
	'http://localhost:5500',
	'http://127.0.0.1:5500'
].filter(Boolean));

function isLocalDevOrigin(origin) {
	try {
		const parsed = new URL(origin);
		return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
	} catch {
		return false;
	}
}

app.use(
	cors({
		origin(origin, callback) {
			// Allow same-origin, server-to-server, and approved browser origins.
			if (!origin || allowedOrigins.has(origin) || isLocalDevOrigin(origin)) {
				return callback(null, true);
			}

			return callback(new Error(`CORS blocked for origin: ${origin}`));
		},
		credentials: true
	})
);
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 200,
	standardHeaders: 'draft-8',
	legacyHeaders: false
});

app.use('/api', apiLimiter);

app.get('/health', (req, res) => {
	res.status(200).json({
		success: true,
		message: 'Server is healthy'
	});
});

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
