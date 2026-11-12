# Contrato de API — Proyecto ReneFULL (Backend)

Estado: la API Node está implementada y cuenta con pruebas unitarias y HTTP sin base de datos. La
migración MySQL de la capa de datos ya existe, pero **su esquema todavía no coincide con los modelos
SQL de esta API**; ambos módulos no deben conectarse hasta acordar un modelo único.

- Stack vigente: **Node.js + Express + MySQL 8** (validación manual, sin ORM ni librería de esquemas).
- Base URL de desarrollo: `http://localhost:3000` (configurable con `PUERTO`).
- Todas las respuestas son JSON UTF-8. El cuerpo de entrada se limita a 100 KB.
- Este documento define los endpoints y DTOs de la API. `INTERFAZ_MIA.md` describe la capa de datos;
  `db/migraciones/001_esquema_inicial.sql` define su esquema MySQL actual, que requiere alineación
  con los modelos de la API antes de usarse en conjunto.

---

## 1. Convenciones

| Concepto | Regla |
| --- | --- |
| Identidad de usuario | UUID de 36 caracteres en minúsculas. En MySQL se guarda como `CHAR(36)`. |
| Producto | Texto con formato `^[A-Z]{1,3}[0-9]{3}$` (ej. `B003`). Nunca se convierte a número. |
| Venta de origen | Texto de 1 a 64 caracteres (`^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`, ej. `D01-066`). |
| Fechas de negocio | `YYYY-MM-DD` (`DATE` en MySQL). |
| Dinero | Número JSON con dos decimales; en MySQL `DECIMAL(12,2)` para precios y `DECIMAL(14,2)` para totales. |
| Correo de entrada | El cuerpo usa `email` por compatibilidad con el formulario móvil. |
| Correo de salida | Las respuestas usan `correo`, nombre canónico de la columna MySQL. |
| Idioma de errores | Mensajes en español; los códigos son estables y en mayúsculas. |

## 2. Autenticación y autorización

- Esquema **Bearer token (JWT, HS256)** en `Authorization: Bearer <token>`.
- El token porta **solo identidad**: `sub` (UUID del usuario), `iat` y `exp`.
- Vigencia acordada: **8 horas** (`JWT_HORAS`, sin renovación automática).
- **El rol y el estado activo se leen de MySQL en cada petición protegida.** Un rol viejo dentro
  del token, un token manipulado o una petición externa no otorgan permisos.
- Una cuenta inexistente o con `activo = 0` equivale a no tener sesión → **401**.
- Sin sesión → **401**. Con sesión válida pero sin rol suficiente → **403**.
- El propietario de ventas, estadísticas y predicciones de cliente se deriva **siempre del token**;
  nunca de la URL, el query string o el cuerpo.
- Los secretos (clave JWT, credenciales de MySQL, hashes) viven en `.env` y nunca se devuelven.

## 3. Códigos de estado y formato de error

| Código | Uso |
| --- | --- |
| 200 | Lectura correcta o idempotencia que devuelve un recurso existente |
| 201 | Recurso creado (registro, venta) |
| 400 | JSON malformado |
| 401 | Sin sesión, token inválido/expirado, cuenta inexistente o inactiva, credenciales incorrectas |
| 403 | Sesión válida sin permiso; auto-modificación de rol |
| 404 | Recurso inexistente; producto o usuario no encontrado |
| 409 | Conflicto de unicidad (correo ya registrado, duplicado de idempotencia irresoluble) |
| 422 | Validación de datos, con detalle por campo |
| 500 | Error interno: mensaje genérico, sin trazas ni datos sensibles |

Formato único de error:

```json
{
  "error": {
    "codigo": "VALIDACION_DATOS",
    "mensaje": "Los datos enviados no son válidos.",
    "campos": {
      "email": "El correo no tiene un formato válido"
    }
  }
}
```

- `codigo` ∈ `JSON_INVALIDO`, `VALIDACION_DATOS`, `NO_AUTENTICADO`, `NO_AUTORIZADO`,
  `NO_ENCONTRADO`, `CONFLICTO`, `ERROR_INTERNO`.
- `campos` solo aparece en `VALIDACION_DATOS`.
- Los errores de MySQL se traducen sin exponer el mensaje original: duplicado → 409, referencia
  inexistente o dato truncado/fuera de rango → 422, resto → 500.

## 4. Endpoints

### 4.1 Salud

`GET /api/salud` — público.

- 200 → `{ "estado": "ok" }`.

### 4.2 Autenticación

| Método y ruta | Auth | Rol |
| --- | --- | --- |
| `POST /api/auth/registro` | público | — |
| `POST /api/auth/login` | público | — |
| `GET /api/auth/me` | token | cualquiera activo |

#### POST /api/auth/registro

Cuerpo:

```json
{
  "nombre": "Mia Paola",
  "email": "Mia@Ejemplo.COM",
  "password": "secreto123"
}
```

- `nombre`: texto obligatorio, 1..120 caracteres (se recorta).
- `email`: obligatorio, formato válido, máximo 254; se normaliza a minúsculas.
- `password`: obligatorio, 8..128 caracteres; se guarda solo como hash **Argon2id**.
- **El registro público siempre crea `cliente`.** Si el cuerpo contiene la propiedad `rol`
  (aunque sea `null`), responde **422** con `campos.rol`.
- `nombre` es obligatorio en el contrato. El formulario móvil actual solo envía correo y
  contraseña; mientras no envíe `nombre`, el registro responderá 422 con `campos.nombre`.
  Este repositorio no modifica `FrontEnd/`.
- 201 → `{ "token": "...", "usuario": { ... } }` con el DTO de usuario (ver §4.6).
- Errores: 400 (JSON inválido), 422 (campos), 409 (`"El correo ya está registrado."`), 500.
- Una carrera de correo duplicado en MySQL también responde 409, sin filtrar detalles.

#### POST /api/auth/login

Cuerpo: `{ "email": string, "password": string }`.

- 200 → `{ "token": "...", "usuario": { ... } }`.
- Correo inexistente, contraseña incorrecta o cuenta inactiva → **401** con el mismo mensaje:
  `"Correo o contraseña incorrectos."` (no revela si el correo existe).
- Errores: 400, 422 (campos), 401, 500.

#### GET /api/auth/me

- 200 → `{ "usuario": { ... } }` con el rol y `activo` **vigentes en MySQL**.
- 401 sin token, token inválido/expirado, usuario inexistente o inactivo.

### 4.3 Ventas del cliente

| Método y ruta | Auth | Rol |
| --- | --- | --- |
| `POST /api/ventas` | token | cliente o administrador |
| `GET /api/ventas/mias` | token | cliente o administrador |
| `GET /api/ventas/mias/estadisticas` | token | cliente o administrador |
| `GET /api/ventas/mias/predicciones` | token | cliente o administrador |

Todas derivan el propietario de `req.usuario.id` (token). Un `propietario_id` o `usuario_id`
enviado por query string se ignora.

#### POST /api/ventas

Cuerpo:

```json
{
  "fecha": "2026-01-15",
  "producto_id": "B003",
  "cantidad": 4,
  "precio_unitario_mxn": 31,
  "clave_idempotencia": "55555555-5555-4555-8555-555555555555"
}
```

- `fecha`: `YYYY-MM-DD`, válida, no futura, no anterior a `2000-01-01`.
- `producto_id`: patrón del catálogo; el producto debe existir y estar `activo = 1`.
- `cantidad`: entero 1..10000.
- `precio_unitario_mxn`: número > 0 y ≤ 1,000,000; debe coincidir con
  `productos.precio_actual_mxn` (tolerancia máxima de 0.01 MXN por redondeo).
- `clave_idempotencia`: opcional, UUID. Si se repite para el mismo propietario, devuelve la venta
  existente con **200** sin insertar otra. Una carrera de unicidad en MySQL se resuelve igual.
- `total_mxn`: **lo calcula el servidor** (`precio × cantidad`, redondeado a dos decimales).
  Si el cuerpo lo declara y no coincide (tolerancia 0.01), responde **422**.
- Se rechazan con **422** las propiedades `propietario_id`, `usuario_id`, `importacion_id` e
  `id_origen`: el propietario y la importación no se fijan desde esta ruta.
- El producto y la categoría se toman del catálogo; no se confía en texto enviado por la app.
- 201 → `{ "venta": { ... } }`; 200 si la clave de idempotencia ya existía.
- Errores: 400, 401, 404 (producto inexistente o inactivo), 422, 500.

#### GET /api/ventas/mias

Query opcional:

| Parámetro | Regla | Valor por defecto |
| --- | --- | --- |
| `desde` | `YYYY-MM-DD` | sin límite inferior |
| `hasta` | `YYYY-MM-DD`; `desde ≤ hasta`; rango máximo 730 días | sin límite superior |
| `limite` | entero 1..500 | 100 |
| `desplazamiento` | entero ≥ 0 | 0 |

- 200 →

```json
{
  "items": [ { "venta": "DTO de §4.6" } ],
  "total": 120,
  "limite": 100,
  "desplazamiento": 0,
  "registros_excluidos": 1
}
```

- `items` solo contiene filas que superan la validación de registro (§5) de la página solicitada.
- `total` es `COUNT(*)` de filas que cumplen el filtro, incluidas las que luego se excluyen.
- `registros_excluidos` cuenta las filas inválidas encontradas en esa página.
- Errores: 400, 401, 422 (fechas o paginación), 500.

#### GET /api/ventas/mias/estadisticas

Query: `desde`, `hasta` (mismas reglas que el listado) y `agrupacion ∈ { "semana", "mes" }`
(por defecto `"semana"`; cualquier otro valor → 422).

- 200 con el DTO de estadísticas de cliente (§4.7).
- Solo se usan ventas válidas del usuario autenticado; las inválidas se cuentan en
  `resumen.registros_excluidos`.
- Errores: 400, 401, 422, 500.

#### GET /api/ventas/mias/predicciones

- Sin parámetros. Usa **todo** el historial válido del usuario autenticado.
- 200 → `{ "predicciones": [ ... ] }`; una entrada por categoría presente en el historial.
- Sin ventas → `{ "predicciones": [] }`. Nunca se fabrican valores.
- Errores: 400, 401, 500.

### 4.4 Administración

| Método y ruta | Auth | Rol |
| --- | --- | --- |
| `GET /api/admin/usuarios` | token | administrador vigente |
| `PATCH /api/admin/usuarios/{id}/rol` | token | administrador vigente |
| `GET /api/admin/estadisticas/ventas` | token | administrador vigente |
| `GET /api/admin/predicciones/demanda` | token | administrador vigente |

El middleware consulta MySQL en cada petición. Un usuario degradado pierde el acceso de
inmediato aunque su token siga vigente.

#### GET /api/admin/usuarios

- 200 → `{ "usuarios": [ { ...usuario, "creado_en": "...", "actualizado_en": "..." } ] }`.
- Orden: `nombre ASC, id ASC`. Sin hashes ni secretos.
- Errores: 400, 401, 403, 500.

#### PATCH /api/admin/usuarios/{id}/rol

Cuerpo: `{ "rol": "cliente" | "administrador" }`.

- `id` que no sea UUID → **404** sin consultar la base.
- Usuario inexistente → **404**.
- Rol ausente o desconocido → **422**.
- Un administrador **no puede cambiar su propio rol** → **403**.
- La promoción es persistente: el nuevo rol se aplica en la siguiente petición porque se lee de MySQL.
- 200 → `{ "usuario": { ... } }`.
- Errores: 400, 401, 403, 404, 422, 500.

#### GET /api/admin/estadisticas/ventas

Query: `desde`, `hasta` (máximo 730 días) y `agrupacion ∈ { "semana", "mes" }`
(por defecto `"semana"`).

- 200 con el DTO administrativo (§4.8).
- Agrega ventas válidas de todos los usuarios y lista clientes (rol `cliente` o con ventas).
- Errores: 400, 401, 403, 422, 500.

#### GET /api/admin/predicciones/demanda?cliente_id={uuid}

- `cliente_id` es **obligatorio** y debe ser UUID → si falta o es inválido, **422**.
- Usuario inexistente → **404**.
- 200 →

```json
{
  "cliente": { "id": "...", "nombre": "...", "correo": "...", "rol": "cliente", "activo": true },
  "predicciones": [ { "prediccion": "DTO de §4.9" } ]
}
```

- Usa únicamente ventas válidas del `cliente_id` indicado.
- Errores: 400, 401, 403, 422, 404, 500.

### 4.5 Endpoint inexistente

Cualquier ruta no registrada → **404** con `codigo: "NO_ENCONTRADO"` y mensaje controlado.

### 4.6 DTO de usuario

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "nombre": "Mia Paola",
  "correo": "mia@ejemplo.com",
  "rol": "cliente",
  "activo": true
}
```

- Nunca incluye `password_hash`.
- `activo` se normaliza a booleano aunque MySQL devuelva `0`/`1`.
- En el listado administrativo se añaden `creado_en` y `actualizado_en` (texto tal como lo
  entrega MySQL con `dateStrings: true`).

### 4.7 DTO de venta

```json
{
  "id": 8,
  "propietario_id": "11111111-1111-4111-8111-111111111111",
  "fecha": "2026-01-15",
  "producto_id": "B003",
  "producto": "Jugo de naranja 1 L",
  "categoria": "Bebidas",
  "precio_unitario_mxn": 31,
  "cantidad": 4,
  "total_mxn": 124,
  "importacion_id": null,
  "id_origen": null,
  "es_demostracion": false
}
```

- `producto_id` e `id_origen` se conservan como **texto**.
- `id` e `importacion_id` son números (claves internas `BIGINT`).
- `producto` y `categoria` provienen del catálogo por `JOIN`, no se guardan en `ventas`.
- `es_demostracion` es `true` cuando la venta pertenece a una importación marcada como demo.
- Una venta manual tiene `importacion_id = null` e `id_origen = null`; una importada tiene
  ambos no nulos.

### 4.8 DTO de estadísticas de cliente

```json
{
  "unidad_cantidad": "unidades",
  "periodo": { "desde": "2026-01-01", "hasta": "2026-06-30", "agrupacion": "semana" },
  "resumen": {
    "transacciones_validas": 100,
    "unidades": 250,
    "importe_mxn": 7800.5,
    "registros_excluidos": 1
  },
  "por_categoria": [
    { "categoria": "Bebidas", "transacciones": 40, "unidades": 100, "importe_mxn": 3100 }
  ],
  "por_semana": [
    {
      "periodo_inicio": "2026-01-05",
      "periodo_fin": "2026-01-11",
      "etiqueta": "2026-W02",
      "categoria": "Bebidas",
      "transacciones": 5,
      "unidades": 12,
      "importe_mxn": 372,
      "completa": true
    }
  ],
  "por_mes": [],
  "por_producto": [
    {
      "producto_id": "B003",
      "producto": "Jugo de naranja 1 L",
      "categoria": "Bebidas",
      "transacciones": 20,
      "unidades": 60,
      "importe_mxn": 1860
    }
  ]
}
```

- `periodo.desde`/`hasta` usan el rango consultado; si no se envió, los límites de las ventas
  válidas; si no hay ventas, `null`.
- Solo se llena `por_semana` **o** `por_mes`, según `agrupacion`; el otro arreglo va vacío.
- `por_semana`/`por_mes` solo contienen periodos con ventas (no se rellenan semanas vacías).
- `completa` es `true` si el periodo del grupo cae íntegramente entre la primera y la última
  venta válida usada en el cálculo. Las semanas se etiquetan en formato ISO (`2026-W02`).
- `por_categoria` ordena por nombre; `por_producto`, por unidades descendentes.
- Importes redondeados a dos decimales.

### 4.9 DTO de estadísticas administrativas

Igual al DTO de cliente, con estos cambios:

- `resumen` añade `total_clientes`.
- Añade `clientes`:

```json
[
  {
    "cliente_id": "11111111-1111-4111-8111-111111111111",
    "nombre": "Mia Paola",
    "correo": "mia@ejemplo.com",
    "rol_actual": "cliente",
    "activo": true,
    "transacciones": 100,
    "unidades": 250,
    "importe_mxn": 7800.5,
    "ultima_venta": "2026-06-30",
    "registros_excluidos": 2,
    "por_categoria": [ ... ]
  }
]
```

- No incluye `por_producto`.
- Se listan usuarios con rol `cliente` **o** con ventas registradas; un cliente sin ventas
  aparece con ceros y `ultima_venta: null`.
- `registros_excluidos` del cliente cuenta solo sus filas inválidas.

### 4.10 DTO de predicción

La respuesta contiene una entrada por categoría. `tipo_resultado` determina la forma:

**A. `sin_historial_suficiente`**

```json
{
  "tipo_resultado": "sin_historial_suficiente",
  "objetivo": "unidades_vendidas_por_categoria_semana",
  "unidad": "unidades",
  "categoria": "Bebidas",
  "periodo_objetivo": {
    "semana_inicio": "2026-07-06",
    "semana_fin": "2026-07-12",
    "semana_iso": "2026-W28"
  },
  "semanas_completas": 6,
  "semanas_con_unidades": 6,
  "minimo_semanas_completas": 12,
  "minimo_semanas_con_unidades": 8,
  "motivo": "No hay suficientes semanas completas para entrenar y evaluar el modelo.",
  "es_estimacion": true
}
```

**B. `modelo_no_supera_linea_base`**

```json
{
  "tipo_resultado": "modelo_no_supera_linea_base",
  "objetivo": "unidades_vendidas_por_categoria_semana",
  "unidad": "unidades",
  "categoria": "Bebidas",
  "periodo_objetivo": { "semana_inicio": "...", "semana_fin": "...", "semana_iso": "..." },
  "metricas": {
    "mae_modelo": 3.4,
    "mae_linea_base": 2.9,
    "supera_linea_base": false
  },
  "motivo": "El modelo no superó la línea base en la evaluación cronológica.",
  "es_estimacion": true
}
```

**C. `prediccion`**

```json
{
  "tipo_resultado": "prediccion",
  "objetivo": "unidades_vendidas_por_categoria_semana",
  "unidad": "unidades",
  "categoria": "Bebidas",
  "periodo_objetivo": { "semana_inicio": "...", "semana_fin": "...", "semana_iso": "..." },
  "valores": { "unidades_estimadas": 24.7, "unidades_redondeadas": 25 },
  "modelo": {
    "algoritmo": "Ridge",
    "variables": [
      "indice_semana",
      "mes",
      "unidades_semana_anterior",
      "promedio_4_semanas_previas",
      "unidades_misma_semana_mes_anterior"
    ],
    "semanas_entrenamiento": 19,
    "semanas_evaluacion": 5
  },
  "metricas": {
    "mae_modelo": 1.8,
    "mae_linea_base": 2.9,
    "supera_linea_base": true
  },
  "es_estimacion": true,
  "fuente_datos": "datos_simulados_de_demostracion",
  "advertencia": "Estimación semanal de unidades basada en ventas históricas. No garantiza la demanda futura."
}
```

- `solo_historial`/`valores` **no existen** si no hay predicción; la app debe leer `tipo_resultado`.
- `periodo_objetivo` es la **siguiente semana ISO completa** posterior a la última semana
  completa del historial (o la siguiente a la semana actual si no hay historial).
- `fuente_datos` ∈ `sin_datos`, `datos_simulados_de_demostracion`,
  `datos_simulados_y_registros_propios`, `registros_propios`.
- `unidades_estimadas` se trunca a cero si el modelo produce un valor negativo.
- No se persisten predicciones.

## 5. Validación de registros leídos de MySQL

Antes de incluir una fila de `ventas` en un listado, estadística o predicción se valida:

- `id` entero positivo y `propietario_id` UUID válido.
- `fecha` real, `YYYY-MM-DD`, entre `2000-01-01` y hoy + 1 día.
- `producto_id` con el patrón del catálogo; `producto` y `categoria` no vacíos.
- `precio_unitario_mxn` > 0 y ≤ 1,000,000; `cantidad` entero 1..10000.
- `total_mxn` > 0, ≤ 10,000,000 y coherente con `precio × cantidad` (tolerancia 0.01).
- `importacion_id` e `id_origen` ambos nulos o ambos no nulos; `id_origen` de 1..64 caracteres.
- `clave_idempotencia` nula o UUID.

Las filas inválidas **nunca** se devuelven ni se usan en cálculos; se cuentan en
`registros_excluidos`. No se corrige ni se completa un registro inválido.

## 6. Predicción de demanda (módulo interno)

- Se ejecuta en el servidor, separada de las rutas; recibe ventas válidas desde MySQL.
- Objetivo: **unidades vendidas por categoría y por semana**.
- Solo usa **semanas ISO completas**; descarta la semana parcial inicial y la final.
- Serie semanal por categoría, incluyendo semanas sin ventas con cero unidades.
- Variables: índice de semana, mes, unidades de la semana anterior, promedio de las cuatro
  semanas previas y unidades de la misma semana del mes anterior (4 semanas atrás).
- Modelo: **Ridge con intercepción, `alpha = 1.0`**, equivalente a
  `sklearn.linear_model.Ridge(alpha=1.0)`.
- Evaluación cronológica sobre las **5 últimas semanas completas**; entrenamiento con las
  observaciones anteriores. Línea base: unidades de la semana previa.
- **Solo se emite `prediccion` si el MAE del modelo es estrictamente menor que el de la línea
  base.** En caso contrario se informa `modelo_no_supera_linea_base`.
- Mínimos: **12 semanas completas** y **8 semanas con unidades positivas**; además se requieren
  al menos `5 + 5 = 10` observaciones para entrenar y evaluar.
- No se leen JSON en tiempo de ejecución ni se inventan valores.
- La predicción de cliente usa solo sus ventas; la administrativa exige `cliente_id` y usa solo
  las ventas de ese usuario.

## 7. Carga de datos de demostración

No es un endpoint. Es un comando de inicialización:

```bash
npm run demo:cargar
```

- Lee `Backend/data/demo/*.json` (o `DEMO_DIRECTORIO` si se define).
- `DEMO_EMAIL` es obligatorio: debe ser una cuenta **cliente activa** existente.
- `ADMIN_EMAIL` es opcional: si se define, la cuenta debe existir, estar activa y ser
  administradora; se guarda como `importado_por`.
- Los cinco conjuntos actuales (`ventas_sucursal_demo_01..05.json`) contienen **100 ventas cada
  uno** (500 en total), **41 productos**, periodo `2026-01-01`..`2026-06-30`. Son datos simulados.
- **Toda la validación ocurre antes de abrir la transacción.** Un conjunto inválido no modifica
  catálogo, importaciones ni ventas.

Validación de cada archivo:

- Objeto raíz con `metadata` (objeto cerrado) y `ventas` (arreglo).
- `metadata` exige exactamente: `conjunto` (1..80), `perfil_demanda` (1..80),
  `datos_simulados: true`, `moneda: "MXN"`, `periodo_inicio`, `periodo_fin`,
  `cantidad_registros` (entero 1..100000, igual al número de ventas). Cualquier campo extra
  invalida el conjunto.
- Cada venta exige exactamente: `id_venta` (texto con patrón de origen), `fecha` (dentro del
  periodo declarado), `producto_id` (patrón del catálogo), `producto`, `categoria`,
  `precio_unitario_mxn` (> 0, ≤ 1,000,000, dos decimales), `cantidad` (entero 1..10000),
  `total_mxn` (> 0, ≤ 10,000,000, dos decimales y coherente con precio × cantidad ± 0.01).
  Cualquier campo extra invalida la venta.
- `id_venta` no puede repetirse dentro del mismo archivo.
- Los archivos del directorio no pueden repetir `conjunto` ni `hash_sha256`.
- Un `producto_id` debe tener el mismo nombre, categoría y precio en todos los archivos.

Carga transaccional e idempotente:

1. Verifica propietario e importador.
2. Si un `conjunto` ya existe con el **mismo hash**, se omite (idempotente). Si existe con otro
   contenido, o el mismo hash aparece con otro conjunto, se aborta.
3. Crea/actualiza categorías y productos del catálogo (`ON DUPLICATE KEY UPDATE`).
4. Inserta una fila en `importaciones` por conjunto nuevo y sus ventas con `id_origen`.
5. `COMMIT`; cualquier error hace `ROLLBACK`.

En tiempo de ejecución la API consulta **solo MySQL**, nunca los JSON.

## 8. Esquema MySQL esperado

La migración ejecutable de la capa de datos está en
`db/migraciones/001_esquema_inicial.sql`. **No coincide todavía con el esquema que esperan los
modelos SQL de la API**: la migración usa `usuarios.id BIGINT` y `ventas.usuario_id`, mientras que
la API espera `usuarios.id CHAR(36)` y consulta `ventas.propietario_id`. También difieren las
columnas y relaciones del catálogo (`productos.producto_id` frente a `productos.id` y la tabla
`categorias`). Se requiere acordar y aplicar una traducción única antes de conectar la API a MySQL.

### 8.1 `usuarios`

| Columna | Tipo MySQL | Regla |
| --- | --- | --- |
| `id` | `CHAR(36)` | PK; UUID generado por la aplicación (`crypto.randomUUID()`). |
| `nombre` | `VARCHAR(120)` | NOT NULL; 1..120 recortado. |
| `correo` | `VARCHAR(254)` | NOT NULL; UNIQUE; minúsculas. |
| `password_hash` | `VARCHAR(255)` | NOT NULL; prefijo `$argon2id$`. |
| `rol` | `VARCHAR(20)` | NOT NULL; `cliente` o `administrador`. |
| `activo` | `TINYINT(1)` | NOT NULL; default 1. |
| `creado_en` | `TIMESTAMP` | NOT NULL; default `CURRENT_TIMESTAMP`. |
| `actualizado_en` | `TIMESTAMP` | NOT NULL; default/actualización explícita. |

Índice: `rol`.

### 8.2 `categorias`

| Columna | Tipo MySQL | Regla |
| --- | --- | --- |
| `id` | `SMALLINT` AUTO_INCREMENT | PK. |
| `nombre` | `VARCHAR(60)` | NOT NULL; UNIQUE; 1..60. |

### 8.3 `productos`

| Columna | Tipo MySQL | Regla |
| --- | --- | --- |
| `id` | `VARCHAR(20)` | PK; `^[A-Z]{1,3}[0-9]{3}$`. |
| `nombre` | `VARCHAR(120)` | NOT NULL. |
| `categoria_id` | `SMALLINT` | FK `categorias.id`; `ON DELETE RESTRICT`. |
| `precio_actual_mxn` | `DECIMAL(12,2)` | NOT NULL; > 0. |
| `activo` | `TINYINT(1)` | NOT NULL; default 1. |
| `creado_en` | `TIMESTAMP` | NOT NULL; default `CURRENT_TIMESTAMP`. |
| `actualizado_en` | `TIMESTAMP` | NOT NULL. |

Índice: `categoria_id`.

### 8.4 `importaciones`

| Columna | Tipo MySQL | Regla |
| --- | --- | --- |
| `id` | `BIGINT` AUTO_INCREMENT | PK. |
| `conjunto` | `VARCHAR(80)` | NOT NULL; UNIQUE; 1..80. |
| `archivo` | `VARCHAR(255)` | NOT NULL. |
| `hash_sha256` | `CHAR(64)` | NOT NULL; UNIQUE; 64 hexadecimales. |
| `perfil_demanda` | `VARCHAR(80)` | NOT NULL. |
| `fuente` | `VARCHAR(40)` | NOT NULL; default `datos_simulados`. |
| `es_demostracion` | `TINYINT(1)` | NOT NULL; default 1. |
| `moneda` | `CHAR(3)` | NOT NULL; `MXN`. |
| `periodo_inicio` | `DATE` | NOT NULL. |
| `periodo_fin` | `DATE` | NOT NULL; ≥ `periodo_inicio`. |
| `cantidad_registros` | `INT` | NOT NULL; > 0. |
| `propietario_id` | `CHAR(36)` | NOT NULL; FK `usuarios.id`; `ON DELETE RESTRICT`. |
| `importado_por` | `CHAR(36)` | NULL; FK `usuarios.id`; `ON DELETE SET NULL`. |
| `importado_en` | `TIMESTAMP` | NOT NULL; default `CURRENT_TIMESTAMP`. |

Restricciones: `UNIQUE(conjunto)`, `UNIQUE(hash_sha256)`, `UNIQUE(id, propietario_id)` (destino
de la FK compuesta de `ventas`). Índice: `propietario_id`.

### 8.5 `ventas`

| Columna | Tipo MySQL | Regla |
| --- | --- | --- |
| `id` | `BIGINT` AUTO_INCREMENT | PK; expuesto como `id`. |
| `importacion_id` | `BIGINT` | NULL; parte de la FK compuesta. |
| `id_origen` | `VARCHAR(64)` | NULL; texto del archivo (`id_venta`). |
| `propietario_id` | `CHAR(36)` | NOT NULL; FK `usuarios.id`; `ON DELETE RESTRICT`. |
| `fecha` | `DATE` | NOT NULL; ≥ `2000-01-01`. |
| `producto_id` | `VARCHAR(20)` | NOT NULL; FK `productos.id`; `ON DELETE RESTRICT`. |
| `precio_unitario_mxn` | `DECIMAL(12,2)` | NOT NULL; > 0 y ≤ 1,000,000. |
| `cantidad` | `INT` | NOT NULL; 1..10000. |
| `total_mxn` | `DECIMAL(14,2)` | NOT NULL; > 0, ≤ 10,000,000 y coherente. |
| `clave_idempotencia` | `CHAR(36)` | NULL; UUID. |
| `creado_en` | `TIMESTAMP` | NOT NULL; default `CURRENT_TIMESTAMP`. |

Restricciones e índices:

- FK compuesta `(importacion_id, propietario_id) → importaciones(id, propietario_id)` con
  `ON DELETE RESTRICT`: impide asociar una venta a una importación de otro cliente.
- `CHECK ((importacion_id IS NULL) = (id_origen IS NULL))`.
- `CHECK (id_origen IS NULL OR CHAR_LENGTH(TRIM(id_origen)) BETWEEN 1 AND 64)`.
- `UNIQUE (importacion_id, id_origen)`: en MySQL los `NULL` se consideran distintos, por lo que
  equivale al índice único parcial de PostgreSQL.
- `UNIQUE (propietario_id, clave_idempotencia)`: misma semántica para ventas manuales.
- Índices: `(propietario_id, fecha)`, `(producto_id, fecha)`, `fecha`, `importacion_id`.
- `CHECK (cantidad BETWEEN 1 AND 10000)`.
- `CHECK (precio_unitario_mxn > 0 AND precio_unitario_mxn <= 1000000)`.
- `CHECK (total_mxn > 0 AND total_mxn <= 10000000)`.
- `CHECK (ABS(total_mxn - precio_unitario_mxn * cantidad) <= 0.01)`.

### 8.6 Traducción y diferencias con PostgreSQL

| Modelo de Ismael | Traducción MySQL |
| --- | --- |
| `uuid` con `gen_random_uuid()` | `CHAR(36)`; UUID generado en Node antes del `INSERT`. |
| `boolean` | `TINYINT(1)`; la API lo normaliza a booleano. |
| `timestamptz` | `TIMESTAMP`; MySQL lo devuelve como texto por `dateStrings: true`. |
| `numeric(12,2)` / `numeric(14,2)` | `DECIMAL(12,2)` / `DECIMAL(14,2)`. |
| `smallint` identidad | `SMALLINT AUTO_INCREMENT`. |
| `bigint` identidad | `BIGINT AUTO_INCREMENT`. |
| Índices únicos parciales | `UNIQUE` simples; la semántica de `NULL` de MySQL los hace equivalentes. |
| `CHECK` con regex `~` | `CHECK` con `REGEXP` (MySQL 8.0.16+). |
| FK compuesta | Igual, con índice requerido en el destino. |

**Bloqueo actual:** no existe DDL MySQL en la rama `Mia-Paola` ni tablas en `proyecto_renefull`.
Mientras no se acuerde y aplique el esquema, no se pueden ejecutar `admin:crear`, `demo:cargar`
ni pruebas de integración reales. No se crea un segundo esquema por cuenta propia para no
duplicar la fuente de verdad.

## 9. Inicialización del primer administrador

```bash
npm run admin:crear
```

- Lee `ADMIN_NOMBRE` (default `"Administrador"`), `ADMIN_EMAIL` y `ADMIN_CONTRASENA` de `.env`.
- Exige contraseña de al menos 8 caracteres y nombre de 1..120.
- Genera el UUID en la aplicación, guarda el hash **Argon2id** y crea la cuenta con rol
  `administrador` y `activo = 1`.
- Si el correo ya existe, se niega a crear otra cuenta.
- No se escribe ninguna contraseña en el repositorio.

## 10. Variables de entorno

| Variable | Uso | Default |
| --- | --- | --- |
| `PUERTO` | Puerto HTTP | `3000` |
| `DB_HOST`, `DB_PUERTO`, `DB_USUARIO`, `DB_CONTRASENA`, `DB_NOMBRE` | Conexión MySQL | `127.0.0.1`, `3306`, `renefull_app`, vacío, `proyecto_renefull` |
| `JWT_SECRETO` | Firma HS256 (**obligatoria**) | — |
| `JWT_HORAS` | Vigencia del token | `8` |
| `ADMIN_NOMBRE` | Nombre de la cuenta inicial | `Administrador` |
| `ADMIN_EMAIL`, `ADMIN_CONTRASENA` | Cuenta inicial | vacío |
| `DEMO_EMAIL` | Cliente que recibe la demo | vacío |
| `DEMO_DIRECTORIO` | Directorio alternativo de JSON demo | `Backend/data/demo` |

`.env` y `node_modules` están ignorados por Git.

## 11. Decisiones confirmadas

1. **Precio de venta:** debe coincidir con el catálogo; tolerancia máxima de 0.01 MXN por redondeo.
2. **Token:** 8 horas, solo identidad, sin renovación automática.
3. **Límites:** consultas de hasta **730 días**; listado con `limite` 1..500 (default 100).
4. **Predicción:** Ridge `alpha = 1`, semanas ISO completas, mínimos 12/8, evaluación de 5
   semanas y línea base de la semana anterior. Si el modelo no supera la línea base, no se
   publican valores.
5. **Registro:** siempre `cliente`; la propiedad `rol` se rechaza con 422.
6. **Auto-modificación de rol:** prohibida; el administrador recibe 403.
7. **Aislamiento:** el propietario de cliente se deriva del token, nunca de la URL o el cuerpo.
8. **Idempotencia de captura:** `clave_idempotencia` UUID por propietario; un reintento devuelve
   la venta existente con 200.
9. **Idempotencia de importación:** `conjunto` y `hash_sha256` únicos; mismo contenido se omite,
   contenido distinto se rechaza.
10. **Datos demo:** simulados, marcados con `es_demostracion`; no se consultan en runtime.
11. **Formato de error:** envoltura `{ error: { codigo, mensaje, campos? } }`.
12. **Registro y `nombre`:** el contrato lo exige; la app móvil debe enviarlo. No se modifica
    `FrontEnd/` desde este backend.

## 12. Estado de verificación

- `npm test` ejecuta pruebas unitarias, de validación y HTTP con modelos simulados; no requiere MySQL.
- `npm run test:integracion` ejecuta la capa de datos contra MySQL 8 y elimina/recrea la base indicada
  por `TEST_DB_NOMBRE`. Use exclusivamente una base desechable.
- La compatibilidad entre los modelos SQL de la API y el DDL de la capa de datos sigue pendiente por
  las diferencias documentadas en §8. No se verificó la API contra esa migración.
