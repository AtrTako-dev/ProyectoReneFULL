# Esquema MySQL 8

Fuente ejecutable única:
[`db/migraciones/001_esquema_inicial.sql`](../db/migraciones/001_esquema_inicial.sql).
El DDL está alineado con [`API_CONTRACT.md`](API_CONTRACT.md), secciones 1 y 8.

## 1. Convenciones

- Motor InnoDB, MySQL 8.0.16 o superior, juego `utf8mb4` con
  `utf8mb4_0900_ai_ci`.
- Identidad de usuario: `CHAR(36)` en ASCII, UUID generado por Node con
  `crypto.randomUUID()`.
- Códigos de producto y de venta de origen: texto ASCII, nunca números.
- Fechas de negocio: `DATE`; marcas de tiempo: `TIMESTAMP`.
- Dinero: `DECIMAL(12,2)` para precios y `DECIMAL(14,2)` para totales.
- Booleanos: `TINYINT(1)` con `CHECK` de 0/1.
- Los precios históricos viven en `ventas`; `productos.precio_actual_mxn` es el
  precio vigente del catálogo.

## 2. Relaciones

```text
usuarios 1 --- N importaciones 1 --- N ventas N --- 1 productos N --- 1 categorias
    |                                    |
    +------------- N ventas -------------+

usuarios 1 --- N importaciones (importado_por, opcional)
```

`ventas` usa una **FK compuesta** `(importacion_id, propietario_id)` hacia
`importaciones(id, propietario_id)`. Así una venta importada no puede quedar
asociada a la importación de otro cliente.

## 3. Tablas

### 3.1 `usuarios`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | `CHAR(36)` ASCII | PK, UUID en minúsculas. |
| `nombre` | `VARCHAR(120)` | NOT NULL, 1..120. |
| `correo` | `VARCHAR(254)` | NOT NULL, UNIQUE, minúsculas. |
| `password_hash` | `VARCHAR(255)` | NOT NULL, prefijo `$argon2id$`. |
| `rol` | `VARCHAR(20)` | NOT NULL, `cliente` o `administrador`. |
| `activo` | `TINYINT(1)` | NOT NULL, default 1. |
| `creado_en` | `TIMESTAMP` | NOT NULL, default `CURRENT_TIMESTAMP`. |
| `actualizado_en` | `TIMESTAMP` | NOT NULL, se actualiza con la fila. |

Índice: `rol`. Restricciones: UUID, nombre, correo en minúsculas, hash
Argon2id, rol permitido y activo 0/1.

### 3.2 `categorias`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | `SMALLINT UNSIGNED` AUTO_INCREMENT | PK. |
| `nombre` | `VARCHAR(60)` | NOT NULL, UNIQUE, 1..60. |

### 3.3 `productos`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | `VARCHAR(20)` ASCII | PK, patrón `^[A-Z]{1,3}[0-9]{3}$`. |
| `nombre` | `VARCHAR(120)` | NOT NULL. |
| `categoria_id` | `SMALLINT UNSIGNED` | FK a `categorias.id`, `ON DELETE RESTRICT`. |
| `precio_actual_mxn` | `DECIMAL(12,2)` | NOT NULL, > 0 y <= 1,000,000. |
| `activo` | `TINYINT(1)` | NOT NULL, default 1. |
| `creado_en` | `TIMESTAMP` | NOT NULL, default `CURRENT_TIMESTAMP`. |
| `actualizado_en` | `TIMESTAMP` | NOT NULL, se actualiza con la fila. |

Índice: `categoria_id`.

### 3.4 `importaciones`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | `BIGINT UNSIGNED` AUTO_INCREMENT | PK. |
| `conjunto` | `VARCHAR(80)` | NOT NULL, UNIQUE. |
| `archivo` | `VARCHAR(255)` | NOT NULL. |
| `hash_sha256` | `CHAR(64)` ASCII | NOT NULL, UNIQUE, hexadecimal. |
| `perfil_demanda` | `VARCHAR(80)` | NOT NULL. |
| `fuente` | `VARCHAR(40)` | NOT NULL, default `datos_simulados`. |
| `es_demostracion` | `TINYINT(1)` | NOT NULL, default 1. |
| `moneda` | `CHAR(3)` ASCII | NOT NULL, `MXN`. |
| `periodo_inicio` | `DATE` | NOT NULL. |
| `periodo_fin` | `DATE` | NOT NULL, no anterior al inicio. |
| `cantidad_registros` | `INT` | NOT NULL, > 0. |
| `propietario_id` | `CHAR(36)` ASCII | NOT NULL, FK a `usuarios.id`, `ON DELETE RESTRICT`. |
| `importado_por` | `CHAR(36)` ASCII | NULL, FK a `usuarios.id`, `ON DELETE SET NULL`. |
| `importado_en` | `TIMESTAMP` | NOT NULL, default `CURRENT_TIMESTAMP`. |

Índices y llaves: `UNIQUE(conjunto)`, `UNIQUE(hash_sha256)`,
`UNIQUE(id, propietario_id)` (destino de la FK compuesta), índice de
`propietario_id` e índice de `importado_por`.

### 3.5 `ventas`

| Columna | Tipo | Regla |
|---|---|---|
| `id` | `BIGINT UNSIGNED` AUTO_INCREMENT | PK. |
| `importacion_id` | `BIGINT UNSIGNED` NULL | Parte de la FK compuesta. |
| `id_origen` | `VARCHAR(64)` ASCII NULL | `id_venta` original del JSON. |
| `propietario_id` | `CHAR(36)` ASCII | NOT NULL, FK a `usuarios.id`. |
| `fecha` | `DATE` | NOT NULL, >= `2000-01-01`. |
| `producto_id` | `VARCHAR(20)` ASCII | NOT NULL, FK a `productos.id`. |
| `precio_unitario_mxn` | `DECIMAL(12,2)` | NOT NULL, > 0 y <= 1,000,000. |
| `cantidad` | `INT` | NOT NULL, 1..10,000. |
| `total_mxn` | `DECIMAL(14,2)` | NOT NULL, > 0, <= 10,000,000 y coherente. |
| `clave_idempotencia` | `CHAR(36)` ASCII NULL | UUID de captura manual. |
| `creado_en` | `TIMESTAMP` | NOT NULL, default `CURRENT_TIMESTAMP`. |

Restricciones e índices:

- FK compuesta `(importacion_id, propietario_id)` a
  `importaciones(id, propietario_id)`, `ON DELETE RESTRICT`.
- FKs simples de propietario y producto, `ON DELETE RESTRICT`.
- `UNIQUE(importacion_id, id_origen)` para no repetir el origen de una
  importación.
- `UNIQUE(propietario_id, clave_idempotencia)` para reintentos de captura.
- Índices `(propietario_id, fecha)`, `(producto_id, fecha)`, `fecha` e
  `importacion_id`.
- `CHECK ((importacion_id IS NULL) = (id_origen IS NULL))`.
- `CHECK` de longitud y patrón de `id_origen`.
- `CHECK` de UUID de propietario y clave de idempotencia.
- `CHECK` de cantidad, precio, total y coherencia
  `ABS(total_mxn - precio × cantidad) <= 0.01`.

En MySQL los valores `NULL` de una clave única se consideran distintos; por eso
`UNIQUE(importacion_id, id_origen)` y
`UNIQUE(propietario_id, clave_idempotencia)` reproducen la semántica de los
índices únicos parciales del modelo lógico.

## 4. Tabla de control de migraciones

`migraciones` guarda `id`, `nombre`, `hash_sha256` y `aplicado_en`. El runner
compara el SHA-256 del archivo con el registrado; si cambia, aborta. Para
evolucionar el esquema se agrega un archivo nuevo, no se edita uno aplicado.
