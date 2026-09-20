import app from './src/app.js';
import connectDB from './src/config/db.js';
import env from './src/config/env.js';

const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Start listening on designated port
    const server = app.listen(env.PORT, () => {
      console.log(`=======================================================`);
      console.log(` LIFERECEIPT API Server running in [${env.NODE_ENV}] mode`);
      console.log(` Port: ${env.PORT}`);
      console.log(` URL:  http://localhost:${env.PORT}`);
      console.log(` Health: http://localhost:${env.PORT}/api/v1/health`);
      console.log(`=======================================================`);
    });

    // Graceful shutdown helper
    const shutdown = (signal) => {
      console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
      server.close(() => {
        console.log('[Server] HTTP server closed.');
        process.exit(0);
      });

      // Force close if it takes longer than 10 seconds
      setTimeout(() => {
        console.error('[Server] Forced shutdown after timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (err) => {
      console.error('[CRITICAL] Unhandled Promise Rejection:', err);
    });

    process.on('uncaughtException', (err) => {
      console.error('[CRITICAL] Uncaught Exception:', err);
      process.exit(1);
    });
  } catch (error) {
    console.error('[Server Init Error] Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
