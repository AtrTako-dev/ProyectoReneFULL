# Contrato de API — Proyecto ReneFULL (Backend)

Estado: **aprobado** (propuestas del §8 confirmadas) — pendiente únicamente el esquema definitivo de `Ismael`.

- Stack confirmado: **Node.js + Express + MySQL** (validación manual, sin librería de esquemas).
- Base URL de desarrollo: `http://localhost:3000` (configurable por `.env`).
- Todas las respuestas son JSON (UTF-8).

---

## 1. Autenticación

- Esquema **Bearer token (JWT, HS256)** enviado en `Authorization: Bearer <token>`.
- El token porta **solo identidad**: `sub` (id de usuario), `iat`, `exp` (duración acordada: 8 horas).
- **El rol efectivo SIEMPRE se resuelve desde la base de datos en cada petición.** Un rol viejo
  dentro del token, un token manipulado o un cliente HTTP externo no otorgan permisos:
  si la BD dice que el usuario es cliente, la ruta administrativa responde 403 aunque el token
  diga lo contrario.
- Los secretos (clave JWT, credenciales de BD, hash de contraseñas) viven en `.env` y **nunca
  se commitean ni se devuelven en respuestas**.

## 2. Códigos de estado

| Código | Uso |
| --- | --- |
| 200 | Lectura correcta |
| 201 | Recurso creado (registro, venta) |
| 400 | JSON malformado o parámetros ausentes/malformados |
| 401 | Sin sesión o token inválido/expirado |
| 403 | Sesión válida sin permiso (rol insuficiente, auto-modificación prohibida) |
| 404 | Recurso inexistente, inaccesible o registro inválido al consultarlo |
| 409 | Conflicto (correo ya registrado) |
| 422 | Validación de datos (con detalle por campo) |
| 500 | Error interno: mensaje genérico, sin stack traces ni datos sensibles |

## 3. Formato de error

```json
{
  "error": {
    "codigo": "VALIDACION_DATOS",
    "mensaje": "Los datos enviados no son válidos",
    "campos": { "email": "El correo no tiene un formato válido" }
  }
}
```

- `codigo` ∈ `JSON_INVALIDO`, `VALIDACION_DATOS`, `NO_AUTENTICADO`, `NO_AUTORIZADO`,
  `NO_ENCONTRADO`, `CONFLICTO`, `ERROR_INTERNO`.
- `campos` solo aparece en 422.
- 401 y 403 se distinguen siempre: sin sesión → 401; con sesión pero sin permiso → 403.

## 4. Endpoints

### 4.1 Autenticación

| Método y ruta | Auth | Rol |
| --- | --- | --- |
| `POST /api/auth/registro` | público | — |
| `POST /api/auth/login` | público | — |
| `GET /api/auth/me` | token | cualquiera |

**POST /api/auth/registro**

- Cuerpo: `{ "nombre": string (1..120), "email": string con formato válido, "password": string (mínimo 8) }`
- **Siempre crea un cliente.** Si el cuerpo incluye la propiedad `rol`, la solicitud se **rechaza con
  422** (el frontend nunca envía rol; rechazarlo explícitamente evita asignaciones silenciosas).
- Contraseña guardada únicamente como hash **Argon2id** (biblioteca especializada).
- 201 → `{ "token": string, "usuario": { "id": number, "nombre": string, "email": string, "rol": "cliente" } }`
- Errores: 422 (campos), 409 (correo ya registrado), 500.

**POST /api/auth/login**

- Cuerpo: `{ "email": string, "password": string }`
- 200 → `{ "token": string, "usuario": { "id", "nombre", "email", "rol" } }`
- Errores: 422 (campos), **401 con mensaje único** `"Correo o contraseña incorrectos"` (no revela
  si el correo existe), 500.

**GET /api/auth/me**

- 200 → `{ "usuario": { "id", "nombre", "email", "rol" } }` con el rol **vigente en BD**.
- 401 sin token.

### 4.2 Ventas de cliente

| Método y ruta | Auth | Rol |
| --- | --- | --- |
| `POST /api/ventas` | token | cliente o administrador |
| `GET /api/ventas/mias?desde=&hasta=` | token | cliente o administrador |
| `GET /api/ventas/mias/estadisticas?desde=&hasta=` | token | cliente o administrador |
| `GET /api/ventas/mias/predicciones?horizonte=` | token | cliente o administrador |

**Propietario:** en todos los casos el propietario se deriva **del token**, nunca de un identificador
en la URL, query string o cuerpo. `GET /api/ventas/mias` **no acepta** un parámetro de usuario: si la
app o una herramienta externa envía uno, se ignora y la respuesta sigue conteniendo solo los registros
del usuario autenticado (cambiar un id no da acceso a datos ajenos).

**POST /api/ventas**

- Cuerpo:
  ```json
  {
    "fecha": "YYYY-MM-DD",
    "producto_id": 1,
    "precio_unitario_mxn": 109.95,
    "cantidad": 2
  }
  ```
- Validaciones de negocio (también en backend, sin depender del frontend):
  - `producto_id` debe existir en el catálogo acordado.
  - `categoria` y `producto` se toman del catálogo (no se confía en texto enviado por la app).
  - `precio_unitario_mxn`: no negativo y **coherente con el precio del catálogo** (política exacta
    a confirmar con Ismael: precio idéntico al catálogo, o margen tolerado).
  - `fecha` válida, no futura y dentro de un rango razonable.
  - `cantidad`: entero ≥ 1.
  - **`total_mxn` lo calcula el servidor** (`precio × cantidad`). Si el cuerpo incluye `total_mxn`
    y no coincide con el calculado → 422 (la app no define totales).
- 201 → `{ "venta": { "id_venta", "fecha", "producto_id", "producto", "categoria", "precio_unitario_mxn", "cantidad", "total_mxn", "usuario_id" } }`
- Errores: 422 (campos), 404 (producto inexistente), 401, 500.

**GET /api/ventas/mias**

- Query opcional: `desde` y `hasta` en `YYYY-MM-DD`; `desde ≤ hasta`; rango máximo a acordar
  (propuesta: 2 años) para evitar consultas excesivas.
- 200 → `{ "total": number, "ventas": [ { venta completa} ] }`
- Solo registros del usuario autenticado, **excluyendo filas inválidas** (consigna 7).

**GET /api/ventas/mias/estadisticas**

- 200 →
  ```json
  {
    "periodo": { "desde": "YYYY-MM-DD", "hasta": "YYYY-MM-DD" },
    "total_ventas": 10,
    "total_unidades": 25,
    "total_importe_mxn": 1234.5,
    "por_categoria": [ { "categoria": "electronics", "ventas": 3, "unidades": 7, "importe_mxn": 400.1 } ]
  }
  ```
- Datos solo del usuario; registros inválidos excluidos del cálculo.

**GET /api/ventas/mias/predicciones**

- Query: `horizonte` (días a estimar), entero 1..90.
- Con base suficiente, 200 →
  ```json
  {
    "tipo": "estimacion",
    "estado": "ok",
    "unidad": "unidades",
    "periodo": { "desde": "YYYY-MM-DD", "hasta": "YYYY-MM-DD" },
    "valores": [ { "fecha": "YYYY-MM-DD", "cantidad_estimada": 4.2 } ],
    "nota": "Estimación generada a partir de las ventas registradas en el periodo histórico."
  }
  ```
- Sin base suficiente, 200 →
  ```json
  {
    "tipo": "estimacion",
    "estado": "sin_base_suficiente",
    "mensaje": "No hay ventas suficientes para estimar la demanda del periodo solicitado.",
    "valores": []
  }
  ```
  **Nunca se fabrica una predicción sin datos.** El resultado siempre se presenta como estimación,
  con periodo y unidad declarados.
- La predicción de cliente usa **exclusivamente** sus ventas.

### 4.3 Administración

| Método y ruta | Auth | Rol |
| --- | --- | --- |
| `GET /api/admin/usuarios` | token | administrador |
| `PATCH /api/admin/usuarios/{id}/rol` | token | administrador |
| `GET /api/admin/estadisticas/ventas?desde=&hasta=&agrupacion=` | token | administrador |
| `GET /api/admin/predicciones/demanda?horizonte=` | token | administrador |

**GET /api/admin/usuarios**

- 200 → `{ "usuarios": [ { "id", "nombre", "email", "rol", "creado_en" } ] }` — sin hashes ni secretos.

**PATCH /api/admin/usuarios/{id}/rol**

- Cuerpo: `{ "rol": "cliente" | "administrador" }`
- La promoción es **persistente**: después de promover, la cuenta tiene permisos de administrador
  al iniciar sesión de nuevo (el permiso se resuelve desde BD).
- **Política de auto-modificación:** un administrador **no puede cambiar su propio rol** por esta
  ruta → 403. (Evita que una sesión administradora se reasigne desde una petición directa.)
- 200 → `{ "usuario": { "id", "nombre", "email", "rol" } }`
- Errores: 404 (usuario inexistente), 422 (rol no admitido), 403 (auto-modificación o rol no
  administrador), 401.

**GET /api/admin/estadisticas/ventas**

- Query: `desde`, `hasta` (`YYYY-MM-DD`, `desde ≤ hasta`, máximo 2 años) y
  `agrupacion ∈ { "semana", "mes" }` → 422 si no se respeta.
- 200 → datos suficientes para tabla y gráfica con la misma respuesta:
  ```json
  {
    "periodo": { "desde": "YYYY-MM-DD", "hasta": "YYYY-MM-DD" },
    "agrupacion": "semana",
    "grupos": [ { "etiqueta": "2026-W40", "ventas": 12, "unidades": 30, "importe_mxn": 1500.0 } ],
    "totales": { "ventas": 120, "unidades": 300, "importe_mxn": 15000.0 },
    "por_categoria": [ { "categoria": "electronics", "ventas": 40, "unidades": 90, "importe_mxn": 6000.0 } ]
  }
  ```
- Registros inválidos excluidos; resultados agregados también validados antes de responder.

**GET /api/admin/predicciones/demanda**

- Query: `horizonte` (1..90).
- Mismo formato de predicción que §4.2, pero sobre el agregado global de ventas válidas de todos
  los usuarios.

### 4.4 Carga de datos de demostración

- **No es un endpoint público.** Es un comando de inicialización controlado:
  `npm run demo:cargar`, que importa `Backend/data/demo/*.json` (datos sintéticos marcados como
  simulados) a la base de datos, asociados a la cuenta cliente indicada en `DEMO_EMAIL`. Los
  registros inválidos se omiten y la carga se rechaza si la cuenta ya tiene ventas (evita duplicados).
- Los cinco conjuntos (`ventas_sucursal_demo_01..05.json`, 100 registros cada uno) están en la rama
  `Atr-Tako`; se solicita que lleguen a `main` para que todas las ramas trabajen con ellos.
- En tiempo de ejecución la API consulta **solo la base de datos**, nunca los JSON.

## 5. Tablas solicitadas a `Ismael`

Solicitud de columnas mínimas para el área de API/autenticación; **el esquema definitivo (tipos,
índices, constraints) lo define Ismael**. Nombres de tabla propuestos:

1. **usuarios** — `id`, `nombre`, `email` (único), `password_hash`, `rol` (`cliente` | `administrador`), `creado_en`.
2. **productos** — `producto_id`, `producto`, `categoria`, `precio_unitario_mxn`
   (para validar producto, categoría y precio de cada venta).
3. **ventas** — `id_venta`, `usuario_id` (propietario), `fecha`, `producto_id`, `producto`,
   `categoria`, `precio_unitario_mxn`, `cantidad`, `total_mxn`.

El backend valida **cada registro leído** antes de devolverlo: las filas inválidas se excluyen de
listados, estadísticas y predicciones; consultar un registro inválido devuelve 404 controlado.

## 6. Módulo de Machine Learning

- La predicción la ejecuta **el propio servidor** como módulo interno del backend (separado de las
  rutas), que recibe ventas válidas desde la base de datos y devuelve la estructura de §4.2.
- Nunca se entrena ni se predice leyendo JSON directamente en la ruta.
- El algoritmo y sus parámetros se acuerdan con el equipo; la respuesta siempre declara
  `tipo: "estimacion"`, periodo y unidad, o `estado: "sin_base_suficiente"`.

## 7. Inicialización del primer administrador

- Comando documentado: `npm run admin:crear`, que lee `ADMIN_EMAIL` y `ADMIN_CONTRASENA` desde `.env`
  y crea la cuenta administradora con hash Argon2id.
- La contraseña **no se escribe en el repositorio**; `.env.example` solo documenta las variables.

## 8. Decisiones confirmadas

1. **Precio de venta:** debe coincidir exactamente con el precio del catálogo; una diferencia
   distinta de cero → 422.
2. **Token:** 8 horas, sin renovación automática.
3. **Límites:** rango máximo de consulta de 2 años (730 días) y `horizonte` máximo de 90 días.
4. **Predicción:** promedio diario ajustado por día de la semana; base mínima de 14 ventas válidas
   en los últimos 90 días; por debajo de ese mínimo → `estado: "sin_base_suficiente"`.
5. **Registro:** la propiedad `rol` se rechaza con 422 (nunca se ignora en silencio).
6. **Auto-modificación de rol:** prohibida; un administrador que intenta cambiar su propio rol
   recibe 403.

## 9. Estado de verificación

- **Pruebas unitarias y de API sin base de datos:** 58 de 58 en verde (`npm test`), con `node:test`
  integrado. Cubren validaciones, formato de errores, tokens, Argon2id, middleware de permisos,
  estadísticas, predicción, validación de registros leídos de BD, serializadores y rutas HTTP
  (salud, 401/403/404, JSON malformado, rechazo de `rol`).
- **Pruebas de integración con MySQL:** pendientes de que existan las tablas del §5 en la base
  `proyecto_renefull` (registro real, login, promoción persistente y alta de ventas).
