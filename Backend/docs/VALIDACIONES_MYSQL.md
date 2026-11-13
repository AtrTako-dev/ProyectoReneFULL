# Catálogo de validaciones

Este documento enumera las validaciones implementadas y su trazabilidad con las
pruebas. Todas aplican a datos simulados de demostración; no se usan ventas
reales.

## 1. Metadatos de cada archivo

| Validación | Regla | Error |
|---|---|---|
| Estructura | El documento es un objeto con `metadata` y `ventas` | `ventas` |
| Conjunto | `conjunto` de 3–80 caracteres, minúsculas, números y `_` | `conjunto` |
| Perfil | `perfil_demanda` de 1–80 caracteres | `perfil_demanda` |
| Simulación | `datos_simulados === true` | `datos_simulados` |
| Moneda | `moneda === "MXN"` | `moneda` |
| Registros | `cantidad_registros` entero y coincide con el arreglo | `cantidad_registros` |
| Periodo | Fechas reales y `periodo_fin >= periodo_inicio` | `periodo_inicio` / `periodo_fin` |
| Cantidad de archivos | Exactamente 5 archivos JSON | `archivos` |
| Tamaño | Exactamente 100 ventas por archivo | `ventas` |
| Duplicados | `conjunto` y hash únicos entre archivos | `conjunto` / `archivo` |

## 2. Filas de venta importadas

| Campo | Validación |
|---|---|
| `id_venta` | Texto de 1–32 caracteres, sin espacios, patrón de código (`D01-066`) |
| `fecha` | `YYYY-MM-DD` real, desde 2000-01-01, no futura, dentro del periodo |
| `producto_id` | Texto con patrón `^[A-Z]{1,3}[0-9]{3}$`; nunca se convierte a número |
| `producto` | Texto de 1–160 caracteres |
| `categoria` | Texto de 1–80 caracteres |
| `precio_unitario_mxn` | Número finito, máximo dos decimales, > 0 y ≤ 1,000,000 |
| `cantidad` | Entero entre 1 y 10,000 |
| `total_mxn` | Número finito, máximo dos decimales, > 0 y ≤ 10,000,000 |
| Coherencia | `total_mxn` debe ser exactamente `precio_unitario_mxn × cantidad` |
| Catálogo | Mismo `producto_id` debe conservar nombre y categoría |
| Precio de catálogo | Si hay dos precios en la misma fecha, se rechaza por ambigüedad |
| Duplicados | `id_venta` no se repite entre los cinco archivos |

Los importes se comparan en centavos enteros para evitar errores de punto
flotante.

## 3. Restricciones de MySQL

| Restricción | Efecto |
|---|---|
| `ck_usuarios_hash` | Solo acepta hashes Argon2id |
| `ck_usuarios_email` | Correo en minúsculas y longitud válida |
| `ck_productos_id` | Conserva el patrón de código de producto |
| `ck_productos_precio` | Precio positivo y acotado |
| `ck_importaciones_hash` | SHA-256 hexadecimal de 64 caracteres |
| `ck_importaciones_fechas` | Periodo coherente |
| `ck_importaciones_*` | Fuente simulada, demostración y moneda MXN |
| `ck_ventas_origen` | `importacion_id` e `id_origen` van juntos o ambos nulos |
| `ck_ventas_total` | Total = precio × cantidad |
| `ck_ventas_cantidad` | Cantidad entre 1 y 10,000 |
| `ck_ventas_fecha` | Fecha desde 2000-01-01 |
| Claves foráneas | Usuario, producto e importación deben existir |
| FK compuesta | La importación debe pertenecer al mismo usuario de la venta |
| Claves únicas | No se duplican conjunto, hash ni origen por importación |

## 4. Consultas y filas leídas de MySQL

`validarVentaBd` vuelve a validar cada fila antes de estadísticas o modelo:

- `id_venta` y `usuario_id` enteros positivos;
- fecha real y no futura;
- `producto_id` de texto con patrón;
- nombre y categoría no vacíos;
- precio, cantidad y total válidos;
- total coherente;
- nombre y categoría coinciden con el catálogo;
- `id_origen`, si existe, es texto de 1–32 caracteres.

Una fila inválida se agrega a `excluidas` y no participa en cálculos. Una
consulta individual inválida lanza `REGISTRO_INVALIDO`.

## 5. Consultas estadísticas

- `usuario_id` obligatorio y entero positivo para consultas de cliente.
- `desde` y `hasta` deben ser fechas reales; `hasta >= desde`.
- El rango máximo es de 730 días.
- `limite` debe ser un entero entre 1 y 50,000.
- `agrupacion` solo admite `semana` o `mes`.
- La variante administrativa usa `usuarioId = null` de forma explícita; un
  `undefined` accidental es un error.

## 6. Modelo de demanda

| Condición | Resultado |
|---|---|
| Menos de 12 semanas completas | `sin_base_suficiente`, sin valores |
| Menos de 8 semanas con unidades | `sin_base_suficiente`, sin valores |
| Menos de 4 muestras de entrenamiento | `sin_base_suficiente`, sin valores |
| Ridge no se puede resolver | `sin_base_suficiente`, sin valores |
| MAE del modelo ≥ MAE de la línea base | `modelo_no_supera_linea_base`, sin valores |
| MAE del modelo < MAE de la línea base | `ok`, valores semanales |

La evaluación es cronológica: las últimas 5 semanas se reservan para prueba y
no se mezclan con entrenamiento. La línea base es la semana anterior. La métrica
es MAE, en unidades.

## 7. Códigos de error públicos

| Código | Uso |
|---|---|
| `VALIDACION_DATOS` | Metadatos, filas, rangos o parámetros inválidos |
| `CONFLICTO_IMPORTACION` | Conjunto, hash o propietario incompatibles |
| `OPERACION_NO_PERMITIDA` | Cuenta demo ausente, inactiva o con rol incorrecto |
| `REGISTRO_INVALIDO` | Venta individual que no pasa la validación |
| `NO_ENCONTRADO` | Venta o usuario inexistente |
| `ERROR_INTERNO` | Error no clasificado; no expone detalles internos |

## 8. Trazabilidad de pruebas

Archivo `pruebas/datos/validacion.test.js`:

- identificadores de texto y centavos;
- rechazo de IDs numéricos;
- totales incongruentes, fechas futuras y precisión decimal;
- metadatos simulados y cantidad de registros;
- validación de filas leídas contra catálogo;
- rango máximo de 730 días;
- lectura de 5 JSON, 500 ventas, 41 productos y 500 IDs únicos.

Archivo `pruebas/datos/ml.test.js`:

- semanas completas y semana parcial final;
- estimación cuando Ridge supera la línea base;
- resultado controlado cuando no la supera;
- resultado controlado por historial insuficiente;
- agregación por categoría sin valores inventados.

Archivo `pruebas/datos/integracion.test.js`:

- tablas, columnas, índices y llaves foráneas;
- migración idempotente y detección de cambios de contenido;
- rechazo de hashes, orígenes y totales inválidos por MySQL;
- carga de 500 ventas, precios históricos e idempotencia;
- conflicto de hash sin duplicar;
- reversión por fila inválida y por trigger de MySQL;
- aislamiento por propietario y exclusión de filas inválidas;
- estados del modelo con los cinco JSON.

Resultado: **21 pruebas aprobadas** en MySQL 8.0.46.
