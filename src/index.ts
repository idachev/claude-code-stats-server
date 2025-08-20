import { env } from "@/common/utils/envConfig";
import { closeDatabase, initializeDatabase } from "@/db/index";
import { app, logger } from "@/server";

// Initialize database before starting server
initializeDatabase()
	.then(() => {
		const server = app.listen(env.PORT, () => {
			const { NODE_ENV, HOST, PORT } = env;
			logger.info(`Server (${NODE_ENV}) running on port http://${HOST}:${PORT}`);
		});

		const onCloseSignal = () => {
			logger.info("sigint received, shutting down");
			server.close(async () => {
				await closeDatabase();
				logger.info("server closed");
				process.exit();
			});
			setTimeout(() => process.exit(1), 10000).unref(); // Force shutdown after 10s
		};

		process.on("SIGINT", onCloseSignal);
		process.on("SIGTERM", onCloseSignal);
	})
	.catch((error) => {
		logger.error("Failed to initialize database:", error);
		process.exit(1);
	});
