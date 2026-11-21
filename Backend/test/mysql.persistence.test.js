import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import app from '../src/app.js';
import { databaseConfig, databaseConfigured, demoAccounts } from '../src/config/env.js';
import { initializeDemoRuntime, closeDemoRuntime, authService, demoServices } from '../src/config/demo-runtime.js';
import { mysqlPool } from '../src/config/mysql-pool.js';
import { DemoDataSeeder } from '../src/services/demo-data-seeder.service.js';
import { requireBusinessAccess, requireBusinessRole } from '../src/middleware/authentication.middleware.js';

let mysqlReady = false;
let persistenceLockConnection = null;
const persistenceLockName = `morestock:persistence:${createHash('sha256')
  .update(databaseConfig.database)
  .digest('hex')
  .slice(0, 32)}`;

async function releasePersistenceLock() {
  if (!persistenceLockConnection) return;
  const connection = persistenceLockConnection;
  persistenceLockConnection = null;
  try {
    await connection.query('SELECT RELEASE_LOCK(?)', [persistenceLockName]);
  } finally {
    connection.release();
  }
}

async function runCleanupSteps(steps) {
  let firstError;
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError) throw firstError;
}

before(async () => {
  const explicitlyEnabled = process.env.RUN_MYSQL_PERSISTENCE_TESTS === 'true';
  const isolatedDatabase = databaseConfig.database.toLowerCase().endsWith('_test');
  const localDatabase = ['localhost', '127.0.0.1', '::1'].includes(databaseConfig.host.toLowerCase());
  if (!explicitlyEnabled || !isolatedDatabase || !localDatabase || !databaseConfigured
    || !demoAccounts.some(account => account.businessId === '201')) return;
  try {
    persistenceLockConnection = await mysqlPool.getConnection();
    const [[lock]] = await persistenceLockConnection.query(
      'SELECT GET_LOCK(?, 0) AS acquired',
      [persistenceLockName],
    );
    if (Number(lock.acquired) !== 1) {
      throw new Error('La base de pruebas ya está siendo usada por otra ejecución.');
    }
    await initializeDemoRuntime();
    mysqlReady = true;
  } catch (error) {
    try {
      await releasePersistenceLock();
    } finally {
      await closeDemoRuntime();
    }
    throw error;
  }
});

after(async () => {
  try {
    await releasePersistenceLock();
  } finally {
    if (mysqlReady) await closeDemoRuntime();
  }
});

test('el inicio de sesión y la membresía demo se leen desde MySQL', async context => {
  if (!mysqlReady) return context.skip('Habilita RUN_MYSQL_PERSISTENCE_TESTS=true y usa una base aislada cuyo nombre termine en _test.');

  const account = demoAccounts.find(item => item.businessId === '201');
  const session = await authService.login({ email: account.email, password: account.password });

  try {
    const membership = await authService.getMembership(session.user.id, '201');
    const authenticated = await authService.authenticate(session.token);
    assert.equal(membership.role, 'business_admin');
    assert.equal(authenticated.user.email, account.email);
    assert.ok(Date.parse(authenticated.expiresAt) > Date.now());
  } finally {
    await authService.logout(session.token);
  }
});

test('el inventario actualizado permanece en MySQL y se restaura al terminar', async context => {
  if (!mysqlReady) return context.skip('Habilita RUN_MYSQL_PERSISTENCE_TESTS=true y usa una base aislada cuyo nombre termine en _test.');

  const businessId = '201';
  const productId = 'PS001';
  const account = demoAccounts.find(item => item.businessId === businessId);
  const session = await authService.login({ email: account.email, password: account.password });
  const note = `prueba-inventario-${randomUUID()}`;
  let original;
  let originalRow;

  try {
    original = await demoServices.inventoryService.get(businessId, productId);
    [[originalRow]] = await mysqlPool.execute(
      `SELECT updated_at FROM current_inventory WHERE business_id = ? AND product_sku = ?`,
      [businessId, productId],
    );
    const changedQuantity = original.quantity + 0.125;

    await assert.rejects(
      demoServices.inventoryService.update(businessId, productId, {
        quantity: original.quantity + 0.0005,
        unit: original.unit,
        userId: session.user.id,
        note,
      }),
      error => error.code === 'INVALID_QUANTITY',
    );
    assert.equal((await demoServices.inventoryService.get(businessId, productId)).quantity, original.quantity);

    await demoServices.inventoryService.update(businessId, productId, {
      quantity: changedQuantity,
      unit: original.unit,
      userId: session.user.id,
      note,
    });
    const persisted = await demoServices.inventoryService.get(businessId, productId);
    assert.equal(persisted.quantity, changedQuantity);
    assert.equal(persisted.isSynthetic, false);
    const movements = await demoServices.inventoryService.getMovements(businessId, productId);
    const movement = movements.find(item => item.note === note);
    assert.equal(movement.quantityDelta, 0.125);
    assert.equal(movement.userId, session.user.id);
  } finally {
    try {
      if (original && originalRow) {
        await mysqlPool.execute(
          `UPDATE current_inventory
           SET quantity_on_hand = ?, data_origin = ?, updated_at = ?
           WHERE business_id = ? AND product_sku = ?`,
          [original.quantity, original.isSynthetic ? 'synthetic' : 'operational', originalRow.updated_at, businessId, productId],
        );
      }
    } finally {
      try {
        await mysqlPool.execute('DELETE FROM inventory_movements WHERE note = ?', [note]);
      } finally {
        await authService.logout(session.token);
      }
    }
  }
});

test('las rutas de inventario registran compras, ventas y rechazan saldos negativos', async context => {
  if (!mysqlReady) return context.skip('Habilita RUN_MYSQL_PERSISTENCE_TESTS=true y usa una base aislada cuyo nombre termine en _test.');

  const businessId = '201';
  const productId = 'PS001';
  const account = demoAccounts.find(item => item.businessId === businessId);
  const session = await authService.login({ email: account.email, password: account.password });
  const notePrefix = `fase4-http-${randomUUID()}`;
  const notes = [`${notePrefix}-compra`, `${notePrefix}-venta`];
  let original;
  let originalRow;
  let server;

  try {
    original = await demoServices.inventoryService.get(businessId, productId);
    [[originalRow]] = await mysqlPool.execute(
      `SELECT updated_at FROM current_inventory WHERE business_id = ? AND product_sku = ?`,
      [businessId, productId],
    );
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
    const sendMovement = async (type, quantity, unit, note) => {
      const response = await fetch(`${baseUrl}/businesses/${businessId}/inventory/${productId}/movements`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${session.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ tipo: type, cantidad: quantity, unidad: unit, nota: note }),
      });
      return { response, body: await response.json() };
    };

    const purchase = await sendMovement('purchase', 2, original.unit, notes[0]);
    assert.equal(purchase.response.status, 201);
    assert.equal(purchase.body.inventario.cantidad, original.quantity + 2);
    assert.equal(purchase.body.movimiento.cambio, 2);

    const sale = await sendMovement('sale', 1, original.unit, notes[1]);
    assert.equal(sale.response.status, 201);
    assert.equal(sale.body.inventario.cantidad, original.quantity + 1);
    assert.equal(sale.body.movimiento.cambio, -1);

    const insufficient = await sendMovement('sale', original.quantity + 100, original.unit, `${notePrefix}-invalida`);
    assert.equal(insufficient.response.status, 409);
    assert.equal(insufficient.body.error.code, 'INSUFFICIENT_INVENTORY');

    const wrongUnit = await sendMovement('purchase', 1, 'unidad-incompatible', `${notePrefix}-unidad`);
    assert.equal(wrongUnit.response.status, 400);
    assert.equal(wrongUnit.body.error.code, 'UNIT_MISMATCH');

    const historyResponse = await fetch(
      `${baseUrl}/businesses/${businessId}/inventory/${productId}/movements?limite=20`,
      { headers: { authorization: `Bearer ${session.token}` } },
    );
    const history = await historyResponse.json();
    assert.equal(historyResponse.status, 200);
    assert.ok(history.movimientos.some(item => item.nota === notes[0] && item.tipo === 'purchase'));
    assert.ok(history.movimientos.some(item => item.nota === notes[1] && item.tipo === 'sale'));
    assert.equal((await demoServices.inventoryService.get(businessId, productId)).quantity, original.quantity + 1);
    assert.equal(history.movimientos.some(item => item.nota === `${notePrefix}-invalida`), false);
    assert.equal(history.movimientos.some(item => item.nota === `${notePrefix}-unidad`), false);
  } finally {
    try {
      if (original && originalRow) {
        await mysqlPool.execute(
          `UPDATE current_inventory
           SET quantity_on_hand = ?, data_origin = ?, updated_at = ?
           WHERE business_id = ? AND product_sku = ?`,
          [original.quantity, original.isSynthetic ? 'synthetic' : 'operational', originalRow.updated_at, businessId, productId],
        );
      }
    } finally {
      try {
        await mysqlPool.execute('DELETE FROM inventory_movements WHERE note LIKE ?', [`${notePrefix}%`]);
      } finally {
        try {
          await authService.logout(session.token);
        } finally {
          if (server?.listening) {
            await new Promise((resolve, reject) => {
              server.close(error => (error ? reject(error) : resolve()));
            });
          }
        }
      }
    }
  }
});

test('la ruta de recomendaciones devuelve evidencia de pronóstico para el negocio', async context => {
  if (!mysqlReady) return context.skip('Habilita RUN_MYSQL_PERSISTENCE_TESTS=true y usa una base aislada cuyo nombre termine en _test.');

  const account = demoAccounts.find(item => item.businessId === '201');
  const session = await authService.login({ email: account.email, password: account.password });
  let server;

  try {
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/v1/businesses/201/recommendations`,
      { headers: { authorization: `Bearer ${session.token}` } },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.ok(body.recomendaciones.length > 0);
    assert.ok(body.recomendaciones.every(item => item.explicacion_detallada.evidencia_pronostico.metodo));
  } finally {
    const cleanupSteps = [() => authService.logout(session.token)];
    if (server) {
      cleanupSteps.push(() => new Promise((resolve, reject) => {
        if (!server.listening) return resolve();
        server.close(error => (error ? reject(error) : resolve()));
      }));
    }
    await runCleanupSteps(cleanupSteps);
  }
});

test('la carga inicial conserva las ventas marcadas como operativas', async context => {
  if (!mysqlReady) return context.skip('Habilita RUN_MYSQL_PERSISTENCE_TESTS=true y usa una base aislada cuyo nombre termine en _test.');

  const [rows] = await mysqlPool.execute(
    `SELECT week_start, units_sold, data_origin
     FROM weekly_sales
     WHERE business_id = ? AND product_sku = ?
     ORDER BY week_start LIMIT 1`,
    ['201', 'PS001'],
  );
  assert.ok(rows[0], 'Debe existir una venta de demostración para PS001.');
  const sale = rows[0];
  const operationalUnits = Number(sale.units_sold) + 1000;

  try {
    await mysqlPool.execute(
      `UPDATE weekly_sales SET units_sold = ?, data_origin = 'operational'
       WHERE business_id = ? AND product_sku = ? AND week_start = ?`,
      [operationalUnits, '201', 'PS001', sale.week_start],
    );
    await new DemoDataSeeder({ pool: mysqlPool }).seed();

    const [persistedRows] = await mysqlPool.execute(
      `SELECT units_sold, data_origin FROM weekly_sales
       WHERE business_id = ? AND product_sku = ? AND week_start = ?`,
      ['201', 'PS001', sale.week_start],
    );
    assert.equal(Number(persistedRows[0].units_sold), operationalUnits);
    assert.equal(persistedRows[0].data_origin, 'operational');
  } finally {
    await mysqlPool.execute(
      `UPDATE weekly_sales SET units_sold = ?, data_origin = ?
       WHERE business_id = ? AND product_sku = ? AND week_start = ?`,
      [sale.units_sold, sale.data_origin, '201', 'PS001', sale.week_start],
    );
  }
});

test('la importación de catálogo, surtido y ventas es idempotente y excluye la matriz', async context => {
  if (!mysqlReady) return context.skip('Habilita RUN_MYSQL_PERSISTENCE_TESTS=true y usa una base aislada cuyo nombre termine en _test.');

  const seedSummary = await new DemoDataSeeder({ pool: mysqlPool }).seed();
  const [counts] = await mysqlPool.execute(
    `SELECT
       (SELECT COUNT(*) FROM businesses WHERE is_reference_only = FALSE) AS businesses,
       (SELECT COUNT(*) FROM businesses WHERE id = '900') AS matrixBusinesses,
       (SELECT COUNT(*) FROM products) AS products,
       (SELECT COUNT(*) FROM business_products) AS assortmentPairs,
       (SELECT COUNT(*) FROM weekly_sales WHERE data_origin = 'synthetic') AS syntheticSales,
       (SELECT COUNT(*) FROM weekly_sales WHERE business_id = '900') AS matrixSales`,
  );

  assert.deepEqual(seedSummary, {
    businesses: 5,
    products: 100,
    businessProducts: 50,
    sales: 2500,
    inventoryItems: 50,
  });
  assert.equal(Number(counts[0].businesses), 5);
  assert.equal(Number(counts[0].matrixBusinesses), 0);
  assert.equal(Number(counts[0].products), 100);
  assert.equal(Number(counts[0].assortmentPairs), 50);
  assert.equal(Number(counts[0].syntheticSales), 2500);
  assert.equal(Number(counts[0].matrixSales), 0);
});

test('registro, membresías, permisos y sesiones respetan el alcance de cada negocio', async context => {
  if (!mysqlReady) return context.skip('Habilita RUN_MYSQL_PERSISTENCE_TESTS=true y usa una base aislada cuyo nombre termine en _test.');

  const adminAccount = demoAccounts.find(account => account.businessId === '201');
  const adminSession = await authService.login({ email: adminAccount.email, password: adminAccount.password });
  const email = `fase3-${randomUUID()}@example.test`;
  const password = 'MoreStock_fase3_2026';
  let registration;
  let login;
  let expiredLogin;

  try {
    registration = await authService.register({ email, password, businessName: 'Negocio de fase tres' });
    assert.equal(registration.negocio.role, 'business_admin');
    assert.equal(await authService.getMembership(registration.user.id, registration.negocio.id).then(item => item.role), 'business_admin');

    await assert.rejects(
      authService.register({ email: email.toUpperCase(), password, businessName: 'Negocio duplicado' }),
      error => error.status === 409,
    );
    await assert.rejects(
      authService.login({ email, password: 'Contraseña incorrecta 2026' }),
      error => error.status === 401,
    );

    await authService.addMember(adminSession.user.id, '201', { email, role: 'employee' });
    const memberships = await authService.getBusinessesForUser(registration.user.id);
    assert.equal(memberships.length, 2);
    assert.equal(memberships.find(item => item.id === '201').role, 'employee');
    assert.equal(await authService.getMembership(registration.user.id, '202'), null);

    let accessError;
    await requireBusinessAccess(authService)(
      { params: { businessId: '202' }, auth: { user: { id: registration.user.id } } },
      {},
      error => { accessError = error; },
    );
    assert.equal(accessError.status, 403);

    let roleError;
    requireBusinessRole('business_admin')(
      { businessMembership: { role: 'employee' } },
      {},
      error => { roleError = error; },
    );
    assert.equal(roleError.status, 403);

    login = await authService.login({ email, password });
    assert.equal(login.user.email, email);
    await authService.logout(login.token);
    await assert.rejects(authService.authenticate(login.token), error => error.status === 401);

    expiredLogin = await authService.login({ email, password });
    const expiredTokenHash = createHash('sha256').update(expiredLogin.token).digest('hex');
    await mysqlPool.execute(
      'UPDATE user_sessions SET expires_at = ? WHERE token_hash = ?',
      [new Date(Date.now() - 1000), expiredTokenHash],
    );
    await assert.rejects(
      authService.authenticate(expiredLogin.token),
      error => error.code === 'SESSION_EXPIRED',
    );

    const [storedUsers] = await mysqlPool.execute(
      'SELECT password_hash FROM users WHERE id = ?',
      [registration.user.id],
    );
    assert.equal(storedUsers[0].password_hash.length, 64);
  } finally {
    const cleanupSteps = [
      ...(login?.token ? [() => authService.logout(login.token)] : []),
      ...(expiredLogin?.token ? [() => authService.logout(expiredLogin.token)] : []),
    ];
    if (registration) {
      cleanupSteps.push(
        () => mysqlPool.execute('DELETE FROM user_sessions WHERE user_id = ?', [registration.user.id]),
        () => mysqlPool.execute('DELETE FROM business_memberships WHERE user_id = ?', [registration.user.id]),
        () => mysqlPool.execute('DELETE FROM businesses WHERE id = ?', [registration.negocio.id]),
        () => mysqlPool.execute('DELETE FROM users WHERE id = ?', [registration.user.id]),
      );
    }
    cleanupSteps.push(() => authService.logout(adminSession.token));
    await runCleanupSteps(cleanupSteps);
  }
});
