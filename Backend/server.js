import { createApp } from './src/app.js';
import { port, serverHost } from './src/config/env.js';
import {
  closeDemoRuntime,
  initializeDemoRuntime,
  initializeForecastRuntime,
} from './src/config/demo-runtime.js';

let runtimeState = 'initializing';
const app = createApp({ readiness: () => runtimeState });
const server = app.listen(port, serverHost);

server.once('listening', () => {
  console.log(`more-stock-api escuchando en ${server.address().address}:${server.address().port}`);
  console.log('Preparando esquema, cuentas y datos de demostración...');
});

server.once('error', async error => {
  runtimeState = 'failed';
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

initializeDemoRuntime().then(seeded => {
  runtimeState = 'ready';
  console.log(
    `MySQL listo; ${seeded.availableBusinesses} negocios y ${seeded.availableSales} ventas disponibles.`,
  );
  initializeForecastRuntime().then(evaluation => {
    console.log(`Pronóstico disponible para ${evaluation.seriesCount} series.`);
  }).catch(() => {
    console.error('No se pudo preparar el pronóstico; el catálogo y el inventario siguen disponibles.');
  });
}).catch(error => {
  runtimeState = 'failed';
  console.error(`No se pudo preparar More Stock: ${error.message}`);
});
