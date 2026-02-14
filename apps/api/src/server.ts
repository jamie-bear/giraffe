import { config } from './config/index.js';
import { buildApp } from './app.js';
import { closeDb } from './db/index.js';
import { closeRedis } from './config/redis.js';

const app = buildApp();

async function start() {
  try {
    await app.listen({ port: config.APP_PORT, host: config.APP_HOST });
    app.log.info(`Server running at http://${config.APP_HOST}:${config.APP_PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

async function shutdown() {
  app.log.info('Shutting down...');
  await app.close();
  await closeRedis();
  await closeDb();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
