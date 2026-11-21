import app from './src/app.js';
import { port, serverHost } from './src/config/env.js';
import { closeDemoRuntime, initializeDemoRuntime } from './src/config/demo-runtime.js';

try {
  const seeded = await initializeDemoRuntime();
  const server = app.listen(port, serverHost);

  server.once('listening', () => {
    console.log(`more-stock-api escuchando en ${server.address().address}:${server.address().port}`);
    console.log(`MySQL listo; ${seeded.availableBusinesses} negocios y ${seeded.availableSales} ventas disponibles.`);
  });

  server.once('error', async error => {
    console.error(`No se pudo iniciar el servidor: ${error.message}`);
    await closeDemoRuntime();
    process.exitCode = 1;
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close(async () => {
        await closeDemoRuntime();
        process.exit(0);
      });
    });
  }
} catch (error) {
  console.error(`No se pudo preparar More Stock: ${error.message}`);
  await closeDemoRuntime();
  process.exitCode = 1;
}
