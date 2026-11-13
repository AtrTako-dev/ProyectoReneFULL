const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  PREFIJO_BASE_PRUEBAS,
  generarNombreBasePruebas,
  hashesAceptables,
  hashContenido,
  validarNombreBase,
  validarNombreBasePruebas,
} = require('../src/db/migraciones');

test('genera nombres temporales únicos con el prefijo exclusivo de pruebas', () => {
  const primero = generarNombreBasePruebas();
  const segundo = generarNombreBasePruebas();

  assert.equal(PREFIJO_BASE_PRUEBAS, 'renefull_test_');
  assert.match(primero, /^renefull_test_[A-Za-z0-9_]+$/);
  assert.match(segundo, /^renefull_test_[A-Za-z0-9_]+$/);
  assert.notEqual(primero, segundo);
  assert.equal(validarNombreBasePruebas(primero), primero);
  assert.equal(validarNombreBasePruebas(segundo), segundo);
});

test('rechaza cualquier nombre de base que no sea exclusivo de pruebas', () => {
  const invalidos = [
    'proyecto_renefull',
    'proyectorenefull_test',
    'renefull_test',
    'renefull_test_',
    'renefull_test_abc;DROP_DATABASE',
    'otra_renefull_test_abc',
    `${PREFIJO_BASE_PRUEBAS}${'a'.repeat(51)}`,
    '',
    null,
    undefined,
  ];

  for (const nombre of invalidos) {
    assert.throws(
      () => validarNombreBasePruebas(nombre),
      /debe empezar con "renefull_test_"/,
      `se esperaba rechazo para ${String(nombre)}`
    );
  }

  // El validador general conserva su comportamiento para la base configurada.
  assert.equal(validarNombreBase('proyecto_renefull'), 'proyecto_renefull');
});

test('el hash canónico ignora CRLF/LF/CR y acepta las variantes históricas', () => {
  const lf = Buffer.from('CREATE TABLE ejemplo (id INT);\n');
  const crlf = Buffer.from('CREATE TABLE ejemplo (id INT);\r\n');
  const cr = Buffer.from('CREATE TABLE ejemplo (id INT);\r');

  assert.equal(hashContenido(lf), hashContenido(crlf));
  assert.equal(hashContenido(lf), hashContenido(cr));

  const aceptables = hashesAceptables(lf);
  assert.equal(aceptables.size, 3);
  assert.ok(aceptables.has(hashContenido(lf)));
  assert.ok(aceptables.has(hashContenido(crlf)));
  assert.ok(aceptables.has(hashContenido(cr)));

  const contenidoDistinto = hashesAceptables(Buffer.from('CREATE TABLE otro (id INT);\n'));
  assert.ok(!contenidoDistinto.has(hashContenido(lf)));
});
