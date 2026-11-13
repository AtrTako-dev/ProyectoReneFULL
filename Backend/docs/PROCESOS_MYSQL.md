# Procesos de datos y modelo

Este documento describe los procesos ejecutables de la parte de datos del
backend. La API Express, la autenticación y las rutas quedan fuera de este
alcance.

## 1. Configuración

Copie `.env.example` a `.env` y configure:

```dotenv
DB_HOST=127.0.0.1
DB_PUERTO=3306
DB_USUARIO=renefull_app
DB_CONTRASENA=
DB_NOMBRE=proyecto_renefull
DEMO_EMAIL=cliente.demo@example.com
DEMO_NOMBRE=Cliente de Demostracion
DEMO_PASSWORD=
IMPORTADO_POR_EMAIL=
MIN_SEMANAS_ENTRENAMIENTO=12
MIN_SEMANAS_CON_UNIDADES=8
SEMANAS_EVALUACION=5
```

`DEMO_PASSWORD` solo se usa para crear la cuenta demo y no debe escribirse en
`.env` si el archivo se comparte; pásala por el entorno del proceso.

El usuario de MySQL necesita permisos para crear la base de desarrollo (o la
base ya debe existir), crear tablas, insertar y consultar. No se guardan
secretos en el repositorio.

## 2. Migración

```bash
npm run db:migrar
```

Fases:

1. valida el nombre de la base;
2. crea la base si no existe;
3. asegura la tabla `migraciones`;
4. aplica cada `.sql` pendiente y registra nombre y hash;
5. omite migraciones ya aplicadas si el hash coincide.

Verificación:

```bash
mysql -u root -p -e "USE proyecto_renefull; SHOW TABLES;"
```

Tablas esperadas: `usuarios`, `productos`, `importaciones`, `ventas`,
`migraciones`.

## 3. Cuenta cliente de demostración

```powershell
$env:DEMO_PASSWORD='una-contraseña-local'
npm run demo:cuenta
```

En Bash:

```bash
DEMO_PASSWORD='una-contraseña-local' npm run demo:cuenta
```

- Normaliza el correo a minúsculas.
- Exige nombre de 1–120 caracteres y contraseña de 8–128.
- Hashea la contraseña con Argon2id.
- Es idempotente: si la cuenta ya existe como cliente activo, no la modifica y
  reporta `ya_existe`.
- No imprime la contraseña ni el hash.

## 4. Carga de los cinco JSON

```bash
npm run demo:cargar
```

### 4.1 Fases de la carga

1. **Lectura y validación previa**: lee exactamente cinco archivos `.json`
   desde `data/demo/`, verifica UTF-8, JSON, metadatos y 100 filas por archivo.
2. **Validación de filas**: conserva `id_venta` e `producto_id` como texto,
   valida fecha real, periodo, producto, categoría, precio, cantidad y total.
3. **Validación de catálogo**: exige coherencia de nombre y categoría por
   `producto_id`; el precio vigente se toma de la venta más reciente.
4. **Transacción**: busca la cuenta cliente, comprueba importaciones previas y
   hashes, crea el catálogo faltante, registra `importaciones` e inserta ventas.
5. **Confirmación**: si todo termina, hace `COMMIT`; ante cualquier error hace
   `ROLLBACK`.

### 4.2 Idempotencia

- La clave única `importaciones.conjunto` evita duplicar un conjunto.
- La clave única `importaciones.hash_sha256` evita cargar el mismo contenido con
  otro nombre.
- La clave única `(importacion_id, id_origen)` evita duplicar una venta de una
  fuente.
- Si el conjunto ya existe con el mismo hash, la carga lo reporta como
  `ya_importado`.
- Si el hash cambió, la carga falla con `CONFLICTO_IMPORTACION`; no borra ni
  modifica lo ya importado.

### 4.3 Resultado esperado

```json
{
  "estado": "ok",
  "totales": {
    "archivos": 5,
    "archivos_importados": 5,
    "archivos_ya_importados": 0,
    "ventas_insertadas": 500,
    "ventas_existentes": 0,
    "productos_catalogo": 41
  }
}
```

Totales verificados: 500 ventas, 1,287 unidades y 36,404.00 MXN.

### 4.4 Errores y reversión

- Metadatos o filas inválidas: `VALIDACION_DATOS`, con archivo, fila, campo y
  mensaje; no se abre la transacción.
- Cuenta inexistente, inactiva o con rol distinto de cliente:
  `OPERACION_NO_PERMITIDA`.
- Conflicto de conjunto, hash o propietario: `CONFLICTO_IMPORTACION`.
- Fallo de MySQL en cualquier inserción: se revierte el catálogo, las
  importaciones y las ventas de esa ejecución.

La prueba de integración crea un trigger temporal que fuerza un fallo en
`ventas` y comprueba que las tres tablas quedan vacías.

## 5. Consultas internas

### 5.1 Ventas válidas por propietario

`listarVentasValidas(usuarioId, { desde, hasta, limite })`:

- exige un `usuario_id` válido (excepto la variante administrativa interna con
  `null`);
- filtra por `ventas.usuario_id`;
- valida cada fila contra el catálogo;
- devuelve `{ ventas, excluidas }`;
- una fila inválida no entra a estadísticas ni al modelo.

`obtenerVentaValida(usuarioId, idVenta)`:

- filtra por propietario e `id_venta`;
- si no existe devuelve `NO_ENCONTRADO`;
- si existe pero es inválida lanza `REGISTRO_INVALIDO` con los campos.

### 5.2 Estadísticas

`estadisticasCliente(usuarioId, { desde, hasta })` devuelve:

```json
{
  "periodo": { "desde": "2026-01-01", "hasta": "2026-06-29" },
  "total_ventas": 500,
  "total_unidades": 1287,
  "total_importe_mxn": 36404,
  "por_categoria": [
    { "categoria": "Abarrotes", "ventas": 93, "unidades": 236, "importe_mxn": 6113.5 }
  ],
  "por_periodo": [
    { "etiqueta": "2026-W02", "periodo_inicio": "2026-01-05", "periodo_fin": "2026-01-11", "ventas": 25, "unidades": 47, "importe_mxn": 1362.5 }
  ],
  "registros_excluidos": 0
}
```

`estadisticasAdmin({ desde, hasta, agrupacion })` devuelve la misma información
global con `grupos` y `totales`.

Los importes se suman en centavos y se devuelven como número con dos decimales.
El rango máximo es de 730 días.

## 6. Modelo de demanda

### 6.1 Entrada

Se alimenta exclusivamente con ventas válidas y del propietario solicitado:

```js
const { ventas } = await cargarVentasParaModelo({ usuarioId });
const resultado = predecirDemanda(ventas, { horizonte: 7 });
```

### 6.2 Preparación

1. Filtra por categoría o toma el total.
2. Agrupa unidades por semana ISO completa (lunes a domingo).
3. Excluye la semana parcial final.
4. Construye muestras con:
   - índice de semana;
   - mes;
   - unidades de la semana anterior;
   - promedio de las cuatro semanas previas;
   - unidades de la misma semana del mes anterior.
5. Divide cronológicamente: las últimas 5 semanas son evaluación; el resto es
   entrenamiento. No hay mezcla aleatoria.

### 6.3 Evaluación

- Modelo: regresión Ridge en JavaScript, `alpha = 1.0`.
- Línea base: unidades de la semana anterior.
- Métrica: MAE (error absoluto medio), interpretable en unidades.
- El modelo solo se usa si `MAE_modelo < MAE_línea_base`.

### 6.4 Estados controlados

| Estado | Significado | `valores` |
|---|---|---|
| `ok` | Hay historial y el modelo supera la línea base | Semanas estimadas |
| `sin_base_suficiente` | Menos de 12 semanas completas, menos de 8 con unidades o no se pudo entrenar | `[]` |
| `modelo_no_supera_linea_base` | El modelo no mejora la línea base en la evaluación | `[]` |

En la demostración, el resultado agregado es
`modelo_no_supera_linea_base`; por categoría hay 4 estimaciones `ok` y 2
categorías controladas sin valores. Esto es un resultado válido: no se fuerza
una predicción cuando no hay evidencia de mejora.

### 6.5 Salida

La salida semanal incluye `periodo`, `valores`, `modelo`, `evaluacion`,
`datos`, `por_categoria`, `resumen_categorias` y `advertencia`. El contrato
detallado está en [`INTERFAZ_MIA.md`](INTERFAZ_MIA.md).

Las predicciones no se persisten. Si se necesitan auditorías, deben guardarse
en una tabla separada con su propio diseño.

## 7. Pruebas

Con MySQL desechable:

```powershell
$env:DB_HOST='127.0.0.1'
$env:DB_PUERTO='3306'
$env:DB_USUARIO='root'
$env:DB_CONTRASENA=''
$env:TEST_DB_NOMBRE='proyectorenefull_test'
npm test
```

Las pruebas:

- crean y eliminan solo `TEST_DB_NOMBRE`;
- aplican la migración real;
- cargan los cinco JSON;
- comprueban idempotencia, conflicto de hash y rollback por trigger;
- comprueban aislamiento por propietario y exclusión de filas inválidas;
- comprueban los estados del modelo y que no se inventen valores.

Resultado verificado en MySQL 8.0.46: **21 pruebas aprobadas** (12 unitarias y
9 de integración).
