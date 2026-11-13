# Catálogo de validaciones

Este documento enumera las validaciones implementadas y su trazabilidad con las
pruebas. Todas aplican a datos simulados de demostración; no se usan ventas
reales.

## 1. Metadatos de cada archivo demo

`src/servicios/importacionDemo.js` valida cada documento antes de abrir la
transacción.

| Validación | Regla |
|---|---|
| Estructura | Objeto raíz con `metadata` y `ventas`; `ventas` debe ser un arreglo. |
| Campos cerrados | `metadata` y cada venta solo admiten las claves del contrato; una clave extra invalida el archivo. |
| `conjunto` | Texto de 1..80 caracteres. |
| `perfil_demanda` | Texto de 1..80 caracteres. |
| `datos_simulados` | Debe ser exactamente `true`. |
| `moneda` | Debe ser exactamente `MXN`. |
| `periodo_inicio`, `periodo_fin` | Fechas reales; el fin no puede ser anterior al inicio. |
| `cantidad_registros` | Entero de 1..100000 e igual al número de ventas. |
| Número de archivos | Debe haber al menos un `.json` válido; el paquete oficial contiene cinco, pero la carga acepta cualquier directorio con al menos un JSON válido. |
| Duplicados | `conjunto` y `hash_sha256` no pueden repetirse entre archivos. |

El paquete oficial `data/demo/` es un conjunto versionado de demostración: cinco
archivos, 100 ventas por archivo, 500 en total, 1,287 unidades, 36,404.00 MXN, 41
productos y 6 categorías. Otros directorios pueden tener otro número de archivos
y de ventas; el importador no impone los totales del paquete oficial.

## 2. Filas de venta importadas

| Campo | Validación |
|---|---|
| `id_venta` | Texto recortado con patrón `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`; no se repite dentro del archivo. Se guarda como `id_origen` de texto. |
| `fecha` | `YYYY-MM-DD` real, desde `2000-01-01`, no futura y dentro del periodo declarado. |
| `producto_id` | Texto con patrón `^[A-Z]{1,3}[0-9]{3}$`; nunca se convierte a número. |
| `producto` | Texto de 1..120 caracteres. |
| `categoria` | Texto de 1..60 caracteres. |
| `precio_unitario_mxn` | Número finito, máximo dos decimales, > 0 y ≤ 1,000,000. Se redondea a centavos. |
| `cantidad` | Entero de 1..10,000. |
| `total_mxn` | Número finito, máximo dos decimales, > 0 y ≤ 10,000,000. |
| Coherencia | `ABS(total_mxn - precio_unitario_mxn × cantidad) <= 0.01`. |
| Catálogo | El mismo `producto_id` debe conservar **nombre, categoría y precio** en todos los archivos. |
| Duplicados | `id_venta` no se repite dentro del archivo. |

Los importes se comparan en centavos para evitar errores de punto flotante. Un
precio histórico distinto entre archivos se rechaza; no se elige
silenciosamente el de la venta más reciente.

## 3. Restricciones físicas de MySQL

El DDL ejecutable es `db/migraciones/001_esquema_inicial.sql`.

| Restricción | Efecto |
|---|---|
| `ck_usuarios_id_uuid` | Identidad de 36 caracteres con formato UUID. |
| `ck_usuarios_correo` | Correo en minúsculas y longitud válida. |
| `ck_usuarios_hash` | Solo acepta hashes Argon2id. |
| `ck_usuarios_rol` | Solo `cliente` o `administrador`. |
| `ck_productos_id` | Patrón de código de producto. |
| `ck_productos_precio` | Precio positivo y acotado. |
| `ck_importaciones_hash` | SHA-256 hexadecimal de 64 caracteres. |
| `ck_importaciones_periodo` | Periodo coherente. |
| `ck_importaciones_moneda` | Moneda `MXN`. |
| `ck_ventas_origen` | `importacion_id` e `id_origen` van juntos o ambos son nulos. |
| `ck_ventas_origen_texto` | Longitud y patrón de `id_origen`. |
| `ck_ventas_propietario_uuid` | Propietario con UUID válido. |
| `ck_ventas_total_coherente` | Total = precio × cantidad con tolerancia de 0.01. |
| `ck_ventas_cantidad` | Cantidad entre 1 y 10,000. |
| `ck_ventas_fecha` | Fecha desde `2000-01-01`. |
| Claves foráneas | Usuario, producto e importación deben existir; borrados en `RESTRICT`. |
| FK compuesta | La importación debe pertenecer al mismo propietario que la venta. |
| Claves únicas | No se duplican conjunto, hash, origen por importación ni clave de idempotencia por propietario. |

Las pruebas de integración (`pruebas/integracion/baseDatos.test.js`) intentan
insertar datos que violan un `CHECK`, un `UNIQUE` y la FK compuesta, y comprueban
los códigos `ER_CHECK_CONSTRAINT_VIOLATED`, `ER_DUP_ENTRY` y
`ER_NO_REFERENCED_ROW_2`. La traducción de `ER_CHECK_CONSTRAINT_VIOLATED` a
`422 VALIDACION_DATOS` también se prueba en `pruebas/errores.test.js`.

## 3.1 Carga demo y catálogo

Además de validar los archivos antes de la transacción, la carga comprueba el
estado de MySQL:

| Validación | Regla |
|---|---|
| Propietario | `DEMO_EMAIL` debe existir, estar activo y tener rol `cliente`. |
| Importador | Si se define `ADMIN_EMAIL`, debe existir, estar activo y tener rol `administrador`. |
| Catálogo inmutable | Un producto existente solo se acepta si coinciden nombre, categoría, precio vigente (comparado en centavos) y `activo = 1`. La carga no sobrescribe ni reactiva. |
| Precio histórico | `ventas.precio_unitario_mxn` conserva el precio de cada venta; `productos.precio_actual_mxn` no se actualiza. |
| Conjunto existente | Se omite solo si coinciden hash y propietario. |
| Conjunto ajeno | Si el conjunto o el hash existe con otro propietario, falla y no reasigna ventas. |
| Concurrencia | `ER_DUP_ENTRY` o `ER_LOCK_DEADLOCK` se traducen a un conflicto controlado con `ROLLBACK`. |

Cualquier discrepancia de catálogo, propietario o contenido revierte la
transacción completa: no quedan categorías, productos, importaciones ni ventas
parciales.

## 4. Consultas y filas leídas de MySQL

`src/servicios/registros.js` vuelve a validar cada fila antes de incluirla en
listados, estadísticas o modelo:

- `id` interno entero positivo;
- `propietario_id` con UUID de 36 caracteres;
- fecha real, desde `2000-01-01` y no futura;
- `producto_id` de texto con patrón de catálogo;
- nombre y categoría no vacíos (la consulta los obtiene del catálogo mediante
  `JOIN`, por lo que no se comparan de nuevo);
- precio, cantidad y total válidos;
- total coherente con precio × cantidad;
- `id_origen`, si existe, texto de 1..64 caracteres;
- `importacion_id` e `id_origen` ambos nulos o ambos presentes;
- `clave_idempotencia` nula o UUID.

Una fila inválida se excluye de listados, estadísticas y predicciones y se
cuenta en `registros_excluidos`. No existe un endpoint de venta individual, así
que no hay una respuesta de error por registro aislado.

## 5. Consultas y parámetros de la API

- El propietario de un cliente se deriva del token, nunca de la URL o el cuerpo.
- `desde` y `hasta` deben ser fechas reales; `hasta >= desde`.
- El rango máximo es de 730 días.
- `limite` es un entero entre 1 y 500 (default 100).
- `agrupacion` solo admite `semana` o `mes`.
- Los endpoints administrativos exigen rol `administrador` leído de MySQL en
  cada petición.
- La captura manual exige que el precio coincida con el catálogo (tolerancia de
  0.01) y que el total sea coherente.
- `clave_idempotencia`, si se envía, debe ser UUID; un reintento devuelve la
  venta existente con 200.

## 6. Modelo de demanda

| Condición | `tipo_resultado` | Valores |
|---|---|---|
| Menos de 12 semanas completas | `sin_historial_suficiente` | No se publican. |
| Menos de 8 semanas con unidades | `sin_historial_suficiente` | No se publican. |
| Menos de 10 observaciones (5 de entrenamiento + 5 de evaluación) | `sin_historial_suficiente` | No se publican. |
| Ridge no se puede resolver | `sin_historial_suficiente` | No se publican. |
| MAE del modelo ≥ MAE de la línea base | `modelo_no_supera_linea_base` | No se publican. |
| MAE del modelo < MAE de la línea base | `prediccion` | Se publican unidades estimadas y redondeadas. |

Cada observación usa las 4 semanas anteriores, por lo que las 10 observaciones
exigen **14 semanas completas** como mínimo efectivo. Las 12 semanas del contrato
son una condición previa: con 12 o 13 semanas nunca se emite `prediccion` y,
cuando además hay 8 semanas con unidades, el motivo es la falta de observaciones.
Esto se cubre en `pruebas/prediccion.test.js`.

La evaluación es cronológica: las últimas 5 semanas se reservan para prueba y no
se mezclan con entrenamiento. La línea base es la semana anterior. La métrica es
MAE en unidades. El objetivo es
`unidades_vendidas_por_categoria_semana` y la unidad es `unidades`.

## 7. Códigos de error públicos

Solo existen los códigos que emite `src/middleware/errores.js`:

| Código | HTTP | Uso |
|---|---|---|
| `JSON_INVALIDO` | 400 | El cuerpo no es JSON válido. |
| `VALIDACION_DATOS` | 422 | Campos, rangos, parámetros o restricciones `CHECK` de MySQL inválidos. |
| `NO_AUTENTICADO` | 401 | Falta la sesión o el token no es válido. |
| `NO_AUTORIZADO` | 403 | La sesión no tiene el rol o permiso requerido. |
| `NO_ENCONTRADO` | 404 | Ruta, usuario o producto inexistente. |
| `CONFLICTO` | 409 | Unicidad irresoluble, por ejemplo un correo ya registrado. |
| `ERROR_INTERNO` | 500 | Error no clasificado; no expone detalles internos. |

Los scripts `admin:crear`, `demo:cuenta` y `demo:cargar` no son endpoints: sus
errores se imprimen en la consola y no usan este catálogo HTTP.

## 8. Trazabilidad de pruebas

- `pruebas/importacionDemo.test.js`: metadatos, campos cerrados, identificadores
  de texto, centavos, totales, fechas, coherencia de nombre/categoría/precio del
  catálogo, paquete oficial de cinco archivos y directorio flexible con al menos
  un JSON válido.
- `pruebas/migraciones.test.js`: prefijo exclusivo `renefull_test_`, nombres
  inválidos, unicidad de nombres temporales y hash canónico con variantes
  CRLF/LF/CR.
- `pruebas/registros.test.js`: validación de filas leídas y exclusión de
  registros inválidos.
- `pruebas/prediccion.test.js`: semanas completas, Ridge, línea base y estados
  controlados.
- `pruebas/validaciones.test.js`: reglas de entrada de la API.
- `pruebas/integracion/baseDatos.test.js`: DDL, tipos, restricciones `CHECK`,
  `UNIQUE` y FK compuesta, rollback, carga de 500 ventas, idempotencia,
  catálogo inmutable, producto inactivo, propietario distinto, conflicto
  concurrente, esquema preexistente incompatible, hash histórico, aislamiento,
  estadísticas, modelo y flujos HTTP reales.

Resultado verificado: **121 pruebas unitarias/HTTP** y **17 pruebas de
integración MySQL** aprobadas con MySQL 8.0.46. Las primeras usan modelos
simulados y no requieren base; las segundas usan una base temporal única con
prefijo `renefull_test_` que se crea y se elimina en la misma ejecución.
