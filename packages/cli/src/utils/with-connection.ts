import { logger } from "./logger";
import { adapter } from "../database";

let isShuttingDown = false;

export const cleanup = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info("\nOperation cancelled by user. Cleaning up...");
  try {
    await adapter.close();
    logger.info("Database connection closed successfully.");
    process.exit(0);
  } catch (error) {
    logger.error("Error while closing database connection:", error);
    process.exit(1);
  }
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

export async function withConnection(action: () => Promise<void>) {
  let initialized = false;
  try {
    adapter.init();
    initialized = true;
    await action();
    process.exit(0);
  } catch (error) {
    if (!isShuttingDown) {
      logger.error("Error during command execution:", error);
    }
  } finally {
    if (initialized && !isShuttingDown) {
      try {
        await adapter.close();
      } catch (error) {
        logger.error("Error while closing database connection:", error);
      }
    }
  }
} 