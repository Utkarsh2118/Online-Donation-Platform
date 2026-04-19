const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');

dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');
const seedDefaultAdmin = require('./utils/seedAdmin');
const { buildAllowedOrigins, isAllowedOrigin } = require('./utils/corsOrigins');

const PORT = Number(process.env.PORT) || 5000;
const allowedOrigins = buildAllowedOrigins(process.env.FRONTEND_URL);

const startServer = async () => {
	try {
		await connectDB();
		await seedDefaultAdmin();

		const httpServer = http.createServer(app);

		const io = new Server(httpServer, {
			cors: {
				origin: (origin, callback) => {
					if (isAllowedOrigin(origin, allowedOrigins)) {
						return callback(null, true);
					}

					return callback(new Error(`Socket CORS blocked for origin: ${origin}`));
				},
				credentials: true
			}
		});

		// Make io available throughout controllers via req.app.get('io').
		app.set('io', io);

		io.on('connection', (socket) => {
			console.log(`Socket connected: ${socket.id}`);

			socket.on('disconnect', () => {
				console.log(`Socket disconnected: ${socket.id}`);
			});
		});

		const startListening = (port, allowRetry = true) => {
			httpServer.once('error', (error) => {
				if (allowRetry && error.code === 'EADDRINUSE' && port === PORT) {
					const fallbackPort = PORT + 1;
					console.warn(`Port ${PORT} is in use, retrying on port ${fallbackPort}`);
					startListening(fallbackPort, false);
					return;
				}

				console.error('Server startup failed:', error.message);
				process.exit(1);
			});

			httpServer.listen(port, () => {
				console.log(`Server running on port ${port}`);
			});
		};

		startListening(PORT);
	} catch (error) {
		console.error('Server startup failed:', error.message);
		process.exit(1);
	}
};

startServer();
