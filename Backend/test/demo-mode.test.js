import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const envModule = new URL('../src/config/env.js', import.meta.url).href;

test('las cuentas demo no se cargan cuando el modo demo está apagado', () => {
  const result = spawnSync(process.execPath, [
    '--input-type=module',
    '-e',
    `import { demoAccounts, demoModeEnabled, serverHost } from ${JSON.stringify(envModule)}; console.log(JSON.stringify({ demoModeEnabled, count: demoAccounts.length, serverHost }));`,
  ], {
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'development', DEMO_MODE: 'false' },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), { demoModeEnabled: false, count: 0, serverHost: '127.0.0.1' });
});

test('el modo demo no puede activarse en producción', () => {
  const result = spawnSync(process.execPath, [
    '--input-type=module',
    '-e',
    `import ${JSON.stringify(envModule)};`,
  ], {
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production', DEMO_MODE: 'true' },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DEMO_MODE solo puede habilitarse con NODE_ENV=development/);
});
