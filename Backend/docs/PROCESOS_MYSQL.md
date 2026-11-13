# Procesos de datos y modelo

Este documento describe los procesos ejecutables del backend **Node.js + Express +
MySQL 8**. La API, la autenticación y las rutas comparten el mismo pool y el mismo
esquema; no existe una segunda capa de datos.

## 1. Configuración

Copie `.env.example` a `.env` y complete, como mínimo:

```dotenv
DB_HOST=127.0.0.1
DB_PUERTO=3306
DB_USUARIO=renefull_app
DB_CONTRASENA=
DB_NOMBRE=proyecto_renefull
DB_CONEXIONES=10
JWT_SECRETO=una-cadena-larga-y-aleatoria-de-al-menos-32-caracteres
```

Para crear las cuentas y cargar la demo:

```dotenv
ADMIN_EMAIL=admin@example.com
ADMIN_CONTRASENA=
DEMO_EMAIL=cliente.demo@example.com
DEMO_NOMBRE=Cliente de Demostracion
DEMO_CONTRASENA=
DEMO_DIRECTORIO=
```

`JWT_SECRETO` solo es obligatorio para arrancar el servidor; los scripts de
migración y de cuentas no lo necesitan. Las contraseñas se leen del entorno o de
`.env` local, se guardan con **Argon2id** y no se imprimen. No guarde secretos en
Git.

## 2. Migración

```bash
npm run db:migrar
```

Fases del runner (`src/db/migraciones.js`):

1. valida que el nombre de la base solo use letras, números y `_`;
2. crea la base con `utf8mb4`/`utf8mb4_0900_ai_ci` si no existe;
3. asegura la tabla `migraciones`;
4. si la base tiene tablas de negocio pero ningún registro de migración,
   **verifica el esquema completo antes de ejecutar DDL**; si no coincide,
   aborta sin crear tablas ni registrar nada;
5. lee los `.sql` de `db/migraciones/` en orden alfabético;
6. ejecuta los pendientes, verifica tablas, columnas, tipos, `UNIQUE`, `CHECK` y
   claves foráneas, y **solo entonces** registra nombre y hash;
7. omite los ya aplicados si el hash coincide y vuelve a verificar el esquema.

El hash se calcula sobre el contenido con finales de línea normalizados a LF. Al
comparar se aceptan las variantes CRLF y CR para no alterar registros escritos en
otras máquinas. La evidencia de las versiones de `001` y la decisión tomada están
en [`HISTORIAL_MIGRACIONES.md`](HISTORIAL_MIGRACIONES.md).

Si un archivo ya aplicado cambió de contenido, el proceso aborta. Si el registro
corresponde al DDL histórico incompatible de `43c2886`, también aborta con un
mensaje explícito, sin editar la tabla `migraciones` ni convertir el esquema de
forma automática. Para cambiar el esquema se agrega una migración nueva; no se
edita una aplicada.

Verificación:

```bash
mysql -u root -p -e "USE proyecto_renefull; SHOW TABLES;"
```

Tablas esperadas: `usuarios`, `categorias`, `productos`, `importaciones`,
`ventas` y `migraciones`.

## 3. Cuentas iniciales

```bash
npm run admin:crear
npm run demo:cuenta
```

- `admin:crear` exige `ADMIN_EMAIL` y `ADMIN_CONTRASENA`; crea un usuario
  `administrador`, activo y con UUID generado por Node. Si el correo ya existe,
  falla para no duplicar la cuenta.
- `demo:cuenta` usa `DEMO_EMAIL`, `DEMO_NOMBRE` y `DEMO_CONTRASENA`. Normaliza el
  correo a minúsculas, valida nombre de 1..120 y contraseña de al menos 8
  caracteres, y es idempotente: si la cuenta ya es un cliente activo, devuelve
  `estado: "existente"` sin modificarla. Si existe con otro rol o inactiva,
  falla.
- La salida de `demo:cuenta` es un JSON con `estado`, `id`, `correo` y `rol`; no
  incluye contraseña ni hash.

## 4. Carga de los cinco JSON

Con `DEMO_EMAIL` apuntando a un cliente activo:

```bash
npm run demo:cargar
```

`ADMIN_EMAIL` es opcional. Si se define, la cuenta debe existir, estar activa y
ser administradora; se guarda en `importaciones.importado_por`.

### 4.1 Fases

1. **Lectura y validación previa**: lee todos los `.json` del directorio
   configurado (`DEMO_DIRECTORIO`; por defecto `data/demo/`), valida UTF-8, JSON
   y metadatos, y comprueba que `cantidad_registros` coincida con el número real
   de ventas de cada archivo. El formato es flexible: basta al menos un JSON
   válido. El paquete oficial versionado contiene exactamente cinco archivos de
   100 ventas cada uno.
2. **Validación de filas**: conserva `id_venta` e `producto_id` como texto,
   valida fecha real, periodo, producto, categoría, precio, cantidad y total.
3. **Validación de catálogo**: exige el mismo nombre, categoría y precio por
   `producto_id` en todos los archivos. El precio vigente sale del catálogo
   consistente; el precio histórico se conserva en cada venta.
4. **Transacción**: busca el propietario y el importador, comprueba importaciones
   previas y su propietario, crea solo los productos y categorías que faltan,
   registra `importaciones` e inserta ventas.
5. **Confirmación**: si todo termina, hace `COMMIT`; ante cualquier error hace
   `ROLLBACK` de catálogo, importaciones y ventas.

Toda la validación ocurre antes de abrir la transacción. Un conjunto inválido no
modifica la base.

### 4.2 Catálogo existente

La carga **no sobrescribe** el catálogo:

- crea la categoría o el producto solo si no existe;
- si el producto existe y difieren nombre, categoría, precio vigente o estado
  activo, falla con el detalle del campo y revierte la transacción completa;
- no reactiva productos inactivos;
- no actualiza `productos.precio_actual_mxn`; los precios históricos de cada
  venta permanecen en `ventas.precio_unitario_mxn`.

### 4.3 Idempotencia

- `UNIQUE(importaciones.conjunto)` evita duplicar un conjunto.
- `UNIQUE(importaciones.hash_sha256)` evita el mismo contenido con otro nombre.
- `UNIQUE(ventas.importacion_id, ventas.id_origen)` evita duplicar una venta de
  una fuente.
- Si el conjunto existe con el mismo hash **y el mismo propietario**, se omite y
  se reporta en `omitidos`, sin tocar el catálogo.
- Si el conjunto existe con otro contenido, el hash aparece con otro conjunto o
  el propietario difiere, la carga falla sin borrar ni modificar lo ya importado.
- Si dos cargas concurrentes compiten por el mismo conjunto o hash, MySQL emite
  `ER_DUP_ENTRY` (o `ER_LOCK_DEADLOCK`); la carga lo traduce a un conflicto
  controlado y revierte su transacción.

### 4.4 Resultado esperado

La carga del paquete oficial de cinco conjuntos produce:

- 5 importaciones;
- 500 ventas (100 por archivo);
- 1,287 unidades;
- 36,404.00 MXN;
- 41 productos;
- 6 categorías.

La segunda ejecución devuelve `importados: []`, `omitidos: 5` y
`ventas_insertadas: 0`, sin duplicar filas ni modificar el catálogo.

### 4.5 Errores y reversión

- Metadatos o filas inválidas: `ErrorImportacion` con archivo, fila, campo y
  motivo; no se abre la transacción.
- Cuenta inexistente, inactiva o con rol incorrecto: error de importación.
- Conflicto de conjunto, hash o propietario: error de importación.
- Catálogo existente con diferencias o producto inactivo: error de importación y
  `ROLLBACK`.
- Fallo de MySQL en cualquier inserción: `ROLLBACK` completo.

La prueba de integración crea un trigger temporal que falla al insertar en
`ventas` y comprueba que `categorias`, `productos`, `importaciones` y `ventas`
quedan vacías.

## 5. Consultas de ejecución

La API y los scripts de consulta leen **solo MySQL**. Los JSON solo se usan en
`demo:cargar`.

### 5.1 Ventas

`ventaModelo.listarPorPropietario(propietarioId, { desde, hasta })` devuelve las
filas con `producto_id`, `id_origen` e `importacion_id` tal como están en MySQL.
`filtrarVentasValidas(ventas)` valida cada fila contra el modelo lógico y separa
las inválidas; estas no participan en estadísticas ni en el modelo.

El propietario de un cliente se deriva siempre del token. La variante
administrativa usa el agregado global y solo está disponible para
`administrador`.

### 5.2 Estadísticas

`estadisticasCliente(ventas, { desde, hasta, agrupacion })` devuelve:

- `periodo`: límites consultados o límites de las ventas válidas;
- `resumen`: `transacciones_validas`, `unidades`, `importe_mxn`,
  `registros_excluidos`;
- `por_categoria`: ordenado por nombre;
- `por_semana` o `por_mes`: filas por **periodo y categoría** (el otro arreglo va
  vacío);
- `por_producto`: ordenado por unidades descendentes.

Los importes se redondean a dos decimales. `completa` indica si el periodo cae
íntegramente dentro de las ventas válidas. El rango máximo es de 730 días.

`estadisticasAdmin` usa la misma estructura, añade `resumen.total_clientes` y el
arreglo `clientes` con todos los usuarios de rol `cliente` (aunque no tengan
ventas) y cualquier usuario que sí tenga ventas. Un cliente sin ventas aparece
con ceros y `ultima_venta: null`.

### 5.3 Predicciones

`predecirTodasLasCategorias(ventas, { hoy })` devuelve un resultado por
categoría. Los estados controlados son:

| `tipo_resultado` | Significado |
|---|---|
| `prediccion` | Ridge supera la línea base y publica valores. |
| `modelo_no_supera_linea_base` | El modelo no mejora la semana anterior; no publica valores. |
| `sin_historial_suficiente` | No hay semanas, unidades o muestras suficientes; no publica valores. |

Los resultados sin valores no inventan cifras. Con los cinco JSON actuales y
`hoy = 2026-07-01`, 4 categorías publican `prediccion` y 2 quedan como
`modelo_no_supera_linea_base`.

## 6. Pruebas

Sin base de datos:

```bash
npm test
```

Las pruebas unitarias y HTTP usan modelos simulados y no abren conexiones MySQL.

Con MySQL real y base temporal:

```powershell
$env:DB_PUERTO='3306'
$env:DB_USUARIO='root'
$env:DB_CONTRASENA=''
# Opcional: si se omite, la prueba genera un nombre único.
$env:TEST_DB_NOMBRE='renefull_test_<sufijo>'
npm run test:integracion
```

Protecciones de la base temporal:

- el nombre debe empezar con `renefull_test_`; cualquier otro nombre se rechaza;
- si se omite `TEST_DB_NOMBRE`, se genera un nombre único con fecha y aleatorio;
- si la base ya existe, la prueba **aborta sin borrarla ni reutilizarla**;
- solo se elimina la base anotada como creada por el proceso actual;
- la base de desarrollo `proyecto_renefull` y las bases compartidas nunca se
  tocan, ni siquiera con `DROP DATABASE`.

La cuenta MySQL debe poder crear y eliminar bases temporales, además de crear
tablas, insertar y consultar.

## 7. Solución de problemas

- **`JWT_SECRETO es obligatorio`**: defina al menos 32 caracteres en `.env` o en
  el entorno antes de `npm start`.
- **`La migración X ya fue aplicada con otro contenido`**: no edite migraciones
  aplicadas; cree un archivo nuevo.
- **`DDL anterior incompatible`**: la base registró el `001` histórico; revise
  [`HISTORIAL_MIGRACIONES.md`](HISTORIAL_MIGRACIONES.md) y defina una migración
  de conversión revisada. El runner no modifica esa base.
- **`El esquema existente no coincide`**: la base tiene tablas de negocio que no
  corresponden al contrato; el runner abortó antes de ejecutar DDL.
- **`La base temporal ... ya existe`**: elija otro `TEST_DB_NOMBRE` con prefijo
  `renefull_test_`; no se borra automáticamente.
- **`DEMO_EMAIL no existe`**: ejecute `npm run demo:cuenta` o corrija el correo.
- **`no sobrescribe el catálogo existente`**: el producto existe con otro nombre,
  categoría, precio o estado; corrija el catálogo o la demo, no fuerce la carga.
- **`factor no válido` / `ER_ACCESS_DENIED_ERROR`**: revise usuario, contraseña y
  permisos de MySQL.
- **La carga se omite**: es el comportamiento idempotente esperado. Consulte la
  tabla `importaciones` y los hashes.
