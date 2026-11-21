import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { once } from 'node:events';
import { Business } from '../src/models/business.model.js';
import { BusinessMembership } from '../src/models/business-membership.model.js';
import { LinearRegressionModel } from '../src/models/linear-regression.model.js';
import app from '../src/app.js';

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
});

test('la ruta de salud responde con el estado del servicio', async () => {
  const response = await fetch(`${baseUrl}/api/v1/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: 'ok',
    service: 'more-stock-api',
  });
});

test('una ruta inexistente devuelve un error 404 en JSON', async () => {
  const response = await fetch(`${baseUrl}/api/v1/ruta-inexistente`);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: { code: 'NOT_FOUND', message: 'Ruta no encontrada.' },
  });
});

test('Business normaliza el nombre y permite cambiarlo', () => {
  const business = new Business({ id: '201', name: '  More Stock  ' });

  assert.equal(business.id, '201');
  assert.equal(business.name, 'More Stock');
  business.rename('Negocio actualizado');
  assert.equal(business.name, 'Negocio actualizado');
  assert.throws(() => business.rename('   '), RangeError);
});

test('BusinessMembership acepta los roles definidos', () => {
  const membership = new BusinessMembership({
    businessId: '201',
    userId: 'usuario-1',
    role: 'employee',
  });

  assert.deepEqual(membership.toPublicObject(), {
    userId: 'usuario-1',
    businessId: '201',
    role: 'employee',
  });
  assert.throws(() => new BusinessMembership({
    businessId: '201',
    userId: 'usuario-1',
    role: 'administrator',
  }), RangeError);
});

test('LinearRegressionModel ajusta, predice y se puede serializar', () => {
  const model = new LinearRegressionModel([1, 2, 3], [3, 5, 7]);

  assert.equal(model.slope, 2);
  assert.equal(model.intercept, 1);
  assert.equal(model.predict(4), 9);
  assert.deepEqual(LinearRegressionModel.fromJSON(model.toJSON()).toJSON(), model.toJSON());
});
