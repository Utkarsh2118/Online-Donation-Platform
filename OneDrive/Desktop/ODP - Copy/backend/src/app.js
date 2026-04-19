const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { buildAllowedOrigins, isAllowedOrigin } = require('./utils/corsOrigins');

const app = express();

const allowedOrigins = buildAllowedOrigins(process.env.FRONTEND_URL);

app.use(
	cors({
		origin(origin, callback) {
			// Allow same-origin, server-to-server, and approved browser origins.
			if (isAllowedOrigin(origin, allowedOrigins)) {
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
