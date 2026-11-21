# Fase 6 — Recomendaciones y explicaciones

## Política de demostración

La recomendación cubre una semana de demanda pronosticada. Calcula un buffer nominal de seguridad del 20 %, redondea hacia arriba según la unidad y compara el inventario actual con la meta resultante:

- **COMPRAR:** el inventario está por debajo de la meta; la cantidad sugerida cubre la diferencia.
- **MANTENER:** el inventario cubre la meta y no supera 1.5 veces esa cantidad.
- **NO_COMPRAR:** el inventario supera 1.5 veces la meta.

Las unidades de conteo del catálogo usan cantidades enteras. Si una unidad de conteo tiene saldo fraccionario, la recomendación se detiene y solicita corregir ese dato. Las unidades medidas permiten hasta tres decimales.

La política tiene versión `demo-basic-v1` y se identifica como una regla escolar de demostración. No descuenta pedidos en tránsito, no estima plazo de entrega, no aplica mínimos de compra y no considera caducidad o vida útil. Por ello, el resultado no representa una orden de compra comercial.

## Calendario comercial

Los eventos y categorías se concentran en `src/config/commercial-calendar.js`. Las fechas fijas y reglas anuales incluyen una versión por año y especifican su fuente. El servicio muestra eventos aplicables a la fecha y categoría consultadas. Los eventos son metadatos: no alteran el pronóstico ni implican que hayan causado un cambio en las ventas.

## Explicación y API

La explicación usa el pronóstico, la métrica temporal seleccionada por la fase 5, el inventario, la política aplicada y los metadatos de calendario. Indica si el origen de datos es sintético y enumera los supuestos y límites de la política.

- `GET /api/v1/businesses/:businessId/products/:productId/recommendation` devuelve la recomendación y su explicación completa.
- `GET /api/v1/businesses/:businessId/products/:productId/explanation` devuelve la explicación en campos estructurados.
- `GET /api/v1/businesses/:businessId/calendar?fecha=AAAA-MM-DD&categoria=...` devuelve eventos, versión anual y la nota de que el calendario no modifica el pronóstico.

Las rutas permanecen protegidas por la sesión y la membresía del negocio de la fase 3.

## Alcance

Las reglas son visibles y reproducibles para la exposición escolar. No se calibraron con ventas reales ni parámetros de proveedores. Las pruebas automatizadas de esta fase quedan pendientes para la etapa de pruebas del proyecto.
