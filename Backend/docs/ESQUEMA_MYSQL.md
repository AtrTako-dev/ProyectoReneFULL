# Esquema MySQL 8

Documento de diseño de la base de datos del backend ReneFULL. La fuente
ejecutable es [`db/migraciones/001_esquema_inicial.sql`](../db/migraciones/001_esquema_inicial.sql);
[`db/esquema.sql`](../db/esquema.sql) es una copia de referencia y debe
mantenerse sincronizada con la migración.

## 1. Convenciones

- Motor: MySQL 8.0, tablas InnoDB.
- Juego de caracteres: `utf8mb4` con `utf8mb4_0900_ai_ci`.
- Dinero: `DECIMAL(12,2)` o `DECIMAL(14,2)`, nunca punto flotante.
- Fechas de negocio: `DATE`; marcas de tiempo: `DATETIME`.
- Identificadores de usuario y venta interna: `BIGINT UNSIGNED AUTO_INCREMENT`.
- Códigos de producto y de origen: `VARCHAR`, porque son códigos de texto.
- Las rutas, tokens y contraseñas en claro no se guardan en la base.

## 2. Relación general

```text
usuarios 1 --- N importaciones 1 --- N ventas N --- 1 productos
    |                                    |
    +------------- N ventas -------------+
```

`importaciones` registra cada archivo simulado y su propietario. `ventas`
registra la venta con el precio histórico y el código de origen. `productos`
contiene el catálogo vigente; la categoría se conserva como etiqueta textual
para no romper el contrato de la API.

## 3. Diccionario de tablas

### 3.1 `usuarios`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK, autoincremental |
| `nombre` | `VARCHAR(120)` | obligatorio, 1–120 caracteres |
| `email` | `VARCHAR(254)` | obligatorio, único, minúsculas, formato de correo |
| `password_hash` | `VARCHAR(255)` | obligatorio, debe iniciar con `$argon2id$` |
| `rol` | `ENUM('cliente','administrador')` | obligatorio, valor por defecto `cliente` |
| `activo` | `TINYINT(1)` | 0 o 1, por defecto 1 |
| `creado_en` | `DATETIME` | por defecto `CURRENT_TIMESTAMP` |
| `actualizado_en` | `DATETIME` | se actualiza con la fila |

Índices: `uq_usuarios_email`, `ix_usuarios_rol`.

### 3.2 `productos`

| Columna | Tipo | Restricciones |
|---|---|---|
| `producto_id` | `VARCHAR(20)` | PK, patrón `^[A-Z]{1,3}[0-9]{3}$` |
| `producto` | `VARCHAR(160)` | obligatorio |
| `categoria` | `VARCHAR(80)` | obligatoria |
| `precio_unitario_mxn` | `DECIMAL(12,2)` | mayor que 0 y máximo 1,000,000 |
| `activo` | `TINYINT(1)` | 0 o 1, por defecto 1 |
| `creado_en` | `DATETIME` | por defecto `CURRENT_TIMESTAMP` |
| `actualizado_en` | `DATETIME` | se actualiza con la fila |

El catálogo guarda el precio **vigente**. El precio de cada venta se conserva
en `ventas.precio_unitario_mxn` y no se reescribe desde el catálogo.

### 3.3 `importaciones`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK, autoincremental |
| `conjunto` | `VARCHAR(80)` | obligatorio, único |
| `archivo` | `VARCHAR(255)` | obligatorio |
| `hash_sha256` | `CHAR(64)` | obligatorio, único, hexadecimal |
| `perfil_demanda` | `VARCHAR(80)` | obligatorio |
| `fuente` | `VARCHAR(40)` | por defecto y restringido a `datos_simulados` |
| `es_demostracion` | `TINYINT(1)` | restringido a 1 |
| `moneda` | `CHAR(3)` | restringido a `MXN` |
| `periodo_inicio` | `DATE` | obligatorio |
| `periodo_fin` | `DATE` | obligatorio, no anterior al inicio |
| `cantidad_registros` | `INT UNSIGNED` | mayor que 0 |
| `propietario_id` | `BIGINT UNSIGNED` | FK a `usuarios.id` |
| `importado_por` | `BIGINT UNSIGNED` | FK opcional a `usuarios.id` |
| `importado_en` | `DATETIME` | por defecto `CURRENT_TIMESTAMP` |

Índices: `uq_importaciones_conjunto`, `uq_importaciones_hash`,
`uq_importaciones_id_propietario`, `ix_importaciones_propietario`,
`ix_importaciones_importado_por`.

La tabla solo admite fuentes de demostración simuladas. Si en el futuro se
requieren fuentes reales, debe agregarse una migración explícita y revisarse la
política de privacidad; no se debe relajar esta restricción sin coordinación.

### 3.4 `ventas`

| Columna | Tipo | Restricciones |
|---|---|---|
| `id_venta` | `BIGINT UNSIGNED` | PK interna, autoincremental |
| `importacion_id` | `BIGINT UNSIGNED` | FK compuesta con `usuario_id`; nulo en ventas manuales |
| `id_origen` | `VARCHAR(32)` | código del JSON; nulo en ventas manuales; único por importación |
| `usuario_id` | `BIGINT UNSIGNED` | FK a `usuarios.id`, propietario |
| `fecha` | `DATE` | obligatoria, desde 2000-01-01 |
| `producto_id` | `VARCHAR(20)` | FK a `productos.producto_id` |
| `producto` | `VARCHAR(160)` | copia histórica del nombre |
| `categoria` | `VARCHAR(80)` | copia histórica de la categoría |
| `precio_unitario_mxn` | `DECIMAL(12,2)` | precio histórico, mayor que 0 |
| `cantidad` | `INT UNSIGNED` | 1–10,000 |
| `total_mxn` | `DECIMAL(14,2)` | igual a `precio_unitario_mxn × cantidad` |
| `creado_en` | `DATETIME` | por defecto `CURRENT_TIMESTAMP` |

Índices: `uq_ventas_importacion_origen`, `ix_ventas_usuario_fecha`,
`ix_ventas_producto_fecha`, `ix_ventas_fecha`,
`ix_ventas_importacion_usuario`.

La llave compuesta `(importacion_id, usuario_id)` referencia
`importaciones(id, propietario_id)`, de modo que una venta importada no puede
quedar registrada a nombre de otro usuario.

### 3.5 `migraciones`

Tabla de control del migrador: `id`, `nombre`, `hash_sha256`, `aplicada_en`.
Permite detectar migraciones ya aplicadas y cambios de contenido.

## 4. Mapa de identificadores

| Concepto | Columna | Tipo | Ejemplo |
|---|---|---|---|
| Venta interna | `ventas.id_venta` | `BIGINT` autoincremental | `1` |
| Venta de origen | `ventas.id_origen` | `VARCHAR(32)` | `D01-066` |
| Producto | `productos.producto_id` | `VARCHAR(20)` | `B003` |
| Usuario | `usuarios.id` | `BIGINT` autoincremental | `4` |
| Importación | `importaciones.id` | `BIGINT` autoincremental | `1` |

Reglas:

1. El `id_venta` interno nunca se toma del JSON ni se envía como identificador
   de origen.
2. El código del JSON se guarda en `id_origen` y se conserva como texto.
3. El `producto_id` se guarda como texto; no se convierte a `Number`.
4. La unicidad de origen es `(importacion_id, id_origen)`, no solo
   `id_origen`, porque distintas fuentes podrían reutilizar códigos.
5. Las ventas manuales de la API tienen `importacion_id = NULL` e
   `id_origen = NULL`; MySQL permite múltiples nulos en la clave única.

## 5. Normalización y decisiones

- `usuarios` y `productos` son catálogos independientes.
- `importaciones` es la entidad que representa la fuente y su propietario.
- `ventas` es la tabla transaccional; guarda una **copia histórica** del nombre,
  categoría y precio del producto para que un cambio de catálogo no altere el
  pasado.
- La categoría se guarda como etiqueta textual en `productos` y `ventas` para
  mantener el contrato de la API (`productos.categoria`). No se crea una tabla
  de categorías porque no tiene atributos propios en el alcance actual.
- El total se guarda y se valida contra precio × cantidad; no se recalcula
  silenciosamente al leer.
- El hash SHA-256 identifica el contenido de cada archivo y evita reimportar
  contenido distinto bajo el mismo conjunto.

## 6. Restricciones relevantes

- `ck_usuarios_hash`: solo hashes Argon2id.
- `ck_productos_id` y `ck_productos_precio`.
- `ck_importaciones_hash`, `ck_importaciones_fechas`,
  `ck_importaciones_registros`, `ck_importaciones_fuente`,
  `ck_importaciones_demostracion`, `ck_importaciones_moneda`.
- `ck_ventas_origen`: importación e identidad de origen van juntas o ambas son
  nulas.
- `ck_ventas_total`: el total debe coincidir exactamente con precio × cantidad.
- `ck_ventas_cantidad`, `ck_ventas_precio`, `ck_ventas_fecha`.
- Claves foráneas con `ON DELETE RESTRICT` para no perder ventas ni catálogo;
  `importado_por` usa `ON DELETE SET NULL`.

## 7. Migración reproducible

```bash
npm run db:migrar
```

El migrador:

1. crea la base si no existe (el usuario debe tener permiso);
2. crea la tabla `migraciones`;
3. ordena los archivos `.sql`;
4. aplica los pendientes y registra su hash;
5. se niega a continuar si una migración ya aplicada cambió de contenido.

MySQL no permite transacciones DDL. Por eso el archivo inicial usa
`CREATE TABLE IF NOT EXISTS`: si una ejecución falla después de crear algunas
tablas, el reintento es seguro. La carga de datos sí es transaccional.
