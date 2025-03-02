import { elizaLogger } from "@elizaos/core";
import IORedis, { Redis } from "ioredis";

export function createRedisConnection(config: {
  host: string;
  port: number;
  username?: string;
  password?: string;
}): Redis {
  const { host, port, username, password } = config;
  const auth = username && password ? `${username}:${password}@` : "";
  const REDIS_CONNECTION = `redis://${auth}${host}:${port}/1`;

  const connection = new IORedis(REDIS_CONNECTION, {
    family: 0,
    lazyConnect: true,
    connectTimeout: 5000,
    maxRetriesPerRequest: null,
  });

  connection.on('error', (error) => {
    elizaLogger.error('Redis connection error:', error);
  });

  connection.on('connect', () => {
    elizaLogger.info('Redis connected successfully');
  });

  return connection;
}