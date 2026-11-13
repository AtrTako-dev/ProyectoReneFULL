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
| Número de archivos | Debe haber al menos un JSON; la carga de demostración espera los cinco conjuntos versionados. |
| Duplicados | `conjunto` y `hash_sha256` no pueden repetirse entre archivos. |

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

## 4. Consultas y filas leídas de MySQL

`src/servicios/registros.js` vuelve a validar cada fila antes de estadísticas o
modelo:

- `id` interno entero positivo;
- `propietario_id` con UUID de 36 caracteres;
- fecha real, desde `2000-01-01` y no futura;
- `producto_id` de texto con patrón de catálogo;
- nombre y categoría no vacíos;
- precio, cantidad y total válidos;
- total coherente;
- nombre y categoría coinciden con el catálogo;
- `id_origen`, si existe, es texto válido;
- `importacion_id` coherente con `id_origen`.

Una fila inválida se excluye de listados, estadísticas y predicciones. Una
consulta individual inválida devuelve un error controlado.

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
| Menos de 4 muestras de entrenamiento | `sin_historial_suficiente` | No se publican. |
| Ridge no se puede resolver | `sin_historial_suficiente` | No se publican. |
| MAE del modelo ≥ MAE de la línea base | `modelo_no_supera_linea_base` | No se publican. |
| MAE del modelo < MAE de la línea base | `prediccion` | Se publican unidades estimadas y redondeadas. |

La evaluación es cronológica: las últimas 5 semanas se reservan para prueba y no
se mezclan con entrenamiento. La línea base es la semana anterior. La métrica es
MAE en unidades. El objetivo es
`unidades_vendidas_por_categoria_semana` y la unidad es `unidades`.

## 7. Códigos de error públicos

| Código | Uso |
|---|---|
| `VALIDACION_DATOS` | Metadatos, filas, rangos o parámetros inválidos. |
| `CONFLICTO_IMPORTACION` | Conjunto, hash o propietario incompatibles. |
| `OPERACION_NO_PERMITIDA` | Cuenta demo ausente, inactiva o con rol incorrecto. |
| `REGISTRO_INVALIDO` | Venta individual que no pasa la validación. |
| `NO_ENCONTRADO` | Venta o usuario inexistente. |
| `ERROR_INTERNO` | Error no clasificado; no expone detalles internos. |

## 8. Trazabilidad de pruebas

- `pruebas/importacionDemo.test.js`: metadatos, campos cerrados, identificadores
  de texto, centavos, totales, fechas, y coherencia de nombre, categoría y precio
  del catálogo.
- `pruebas/registros.test.js`: validación de filas leídas y exclusión de
  registros inválidos.
- `pruebas/prediccion.test.js`: semanas completas, Ridge, línea base y estados
  controlados.
- `pruebas/validaciones.test.js`: reglas de entrada de la API.
- `pruebas/integracion/baseDatos.test.js`: DDL, tipos, FK compuesta, rollback,
  carga de 500 ventas, idempotencia, aislamiento, estadísticas, modelo y flujos
  HTTP reales.

Resultado verificado: **112 pruebas unitarias/HTTP** y **9 pruebas de
integración MySQL** aprobadas con MySQL 8.0.46.
