# Fase 4 — Catálogo, ventas e inventario

## Objetivo

Importar el catálogo global, el surtido independiente de cada negocio y sus ventas semanales. Mantener el inventario actual separado del historial sintético y registrar cada cambio con su movimiento.

## Implementación

- El lector procesa los CSV por flujo, limita el tamaño de campo y reporta errores con archivo y fila. No carga todo el historial en memoria.
- El importador usa el catálogo global de 100 productos y el surtido explícito de 50 asociaciones para cinco negocios. Rechaza productos o negocios desconocidos, relaciones repetidas y datos de producto que no coinciden con el catálogo.
- Las ventas se leen solo de los cinco CSV de tiendas. La matriz de referencia no se importa. Se valida la semana, las fechas, los valores numéricos, la precisión admitida por MySQL, las banderas y el surtido.
- La carga inicial se ejecuta en una transacción y puede repetirse sin duplicar ventas. Conserva filas operativas y rechaza un `registro_id` que ya pertenezca a otra combinación de negocio, producto y semana.
- El saldo actual se guarda por negocio y producto. Las cantidades se manejan con precisión de milésimas para coincidir con `DECIMAL(14,3)`.
- Las rutas de inventario requieren sesión y membresía del negocio. `PUT /api/v1/businesses/:businessId/inventory/:productId` registra un ajuste; `GET` y `POST /api/v1/businesses/:businessId/inventory/:productId/movements` consultan y registran movimientos de compra, venta, merma o ajuste. Saldo y movimiento se guardan en una sola transacción. Se rechazan unidades incompatibles y movimientos que produzcan saldo negativo.

## Verificación

La suite del backend terminó con **17 pruebas aprobadas, 0 fallidas y 0 omitidas**, ejecutadas contra el MySQL local. Incluye lectura CSV por flujo, validaciones de importación, exclusión de la matriz, persistencia de inventario, historial de movimientos, rechazo de operaciones inválidas, protección de datos operativos e idempotencia de la carga.

Después de las pruebas, MySQL conserva 5 negocios operativos, 0 negocios de matriz, 100 productos, 50 asociaciones de surtido, 2,500 ventas sintéticas, 50 saldos iniciales y 0 movimientos temporales de prueba.

## Alcance

La carga utiliza los archivos de datos sintéticos del proyecto. No representa ventas reales ni integra todavía una interfaz Android. Las rutas permiten operar los datos dentro de los negocios autorizados por la fase 3.
