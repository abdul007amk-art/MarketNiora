import { buildRoutes } from './routes/index.ts';
import { createDependencies } from './dependencies.ts';
import { createApp } from './server.ts';
import { productionRuntimeBlockReason } from './runtimeGuard.ts';

const productionBlock = productionRuntimeBlockReason();
if (productionBlock) {
  // Do not start the server in production mode while auth persistence, KMS,
  // data ingestion and deployed-runtime validation are still unverified.
  console.error(productionBlock);
  process.exitCode = 1;
} else {
  const rawPort = process.env.PORT ?? '3000';
  const port = Number(rawPort);
  const host = process.env.HOST ?? '0.0.0.0';

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error('PORT must be an integer between 0 and 65535.');
    process.exitCode = 1;
  } else {
    const app = createApp(buildRoutes(), createDependencies());
    app.on('error', () => {
      // Never log environment values, request contents or provider secrets.
      console.error('MarketNiora server failed to start.');
      process.exitCode = 1;
    });

    app.listen(port, host, () => {
      const address = app.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      console.log('MarketNiora server listening on ' + host + ':' + actualPort + ' (non-production mode).');
    });

    const shutdown = () => {
      app.close(() => {
        process.exitCode = 0;
      });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }
}
