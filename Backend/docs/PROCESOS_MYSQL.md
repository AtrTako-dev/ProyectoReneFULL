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
4. lee los `.sql` de `db/migraciones/` en orden alfabético;
5. aplica los pendientes y registra nombre y SHA-256;
6. omite los ya aplicados si el hash coincide.

Si un archivo ya aplicado cambió de contenido, el proceso aborta. Para cambiar
el esquema se agrega una migración nueva; no se edita una aplicada.

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

1. **Lectura y validación previa**: lee todos los `.json` de `data/demo/` (la
   demo versionada tiene cinco), valida UTF-8, JSON y metadatos, y comprueba que
   `cantidad_registros` coincida con el número real de ventas de cada archivo.
2. **Validación de filas**: conserva `id_venta` e `producto_id` como texto,
   valida fecha real, periodo, producto, categoría, precio, cantidad y total.
3. **Validación de catálogo**: exige el mismo nombre, categoría y precio por
   `producto_id` en todos los archivos. El precio vigente sale del catálogo
   consistente; el precio histórico se conserva en cada venta.
4. **Transacción**: busca el propietario y el importador, comprueba importaciones
   previas, crea el catálogo, registra `importaciones` e inserta ventas.
5. **Confirmación**: si todo termina, hace `COMMIT`; ante cualquier error hace
   `ROLLBACK` de catálogo, importaciones y ventas.

Toda la validación ocurre antes de abrir la transacción. Un conjunto inválido no
modifica la base.

### 4.2 Idempotencia

- `UNIQUE(importaciones.conjunto)` evita duplicar un conjunto.
- `UNIQUE(importaciones.hash_sha256)` evita el mismo contenido con otro nombre.
- `UNIQUE(ventas.importacion_id, ventas.id_origen)` evita duplicar una venta de
  una fuente.
- Si el conjunto existe con el mismo hash, se omite y se reporta en
  `omitidos`.
- Si el conjunto existe con otro contenido, o el hash aparece con otro conjunto,
  la carga falla sin borrar ni modificar lo ya importado.

### 4.3 Resultado esperado

La carga de los cinco conjuntos actuales produce:

- 5 importaciones;
- 500 ventas;
- 1,287 unidades;
- 36,404.00 MXN;
- 41 productos;
- 6 categorías.

La segunda ejecución devuelve `importados: []`, `omitidos: 5` y
`ventas_insertadas: 0`, sin duplicar filas.

### 4.4 Errores y reversión

- Metadatos o filas inválidas: `ErrorImportacion` con archivo, fila, campo y
  motivo; no se abre la transacción.
- Cuenta inexistente, inactiva o con rol incorrecto: error de importación.
- Conflicto de conjunto o hash: error de importación.
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

Con MySQL real y base desechable:

```powershell
$env:DB_PUERTO='3306'
$env:DB_USUARIO='root'
$env:DB_CONTRASENA=''
$env:TEST_DB_NOMBRE='proyectorenefull_test'
npm run test:integracion
```

La prueba de integración crea y elimina la base indicada. No use el nombre de
una base de desarrollo o producción como `TEST_DB_NOMBRE`.

## 7. Solución de problemas

- **`JWT_SECRETO es obligatorio`**: defina al menos 32 caracteres en `.env` o en
  el entorno antes de `npm start`.
- **`La migración X ya fue aplicada con otro contenido`**: no edite migraciones
  aplicadas; cree un archivo nuevo.
- **`DEMO_EMAIL no existe`**: ejecute `npm run demo:cuenta` o corrija el correo.
- **`factor no válido` / `ER_ACCESS_DENIED_ERROR`**: revise usuario, contraseña y
  permisos de MySQL.
- **La carga se omite**: es el comportamiento idempotente esperado. Consulte la
  tabla `importaciones` y los hashes.
