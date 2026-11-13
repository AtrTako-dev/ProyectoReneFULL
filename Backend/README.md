# Backend Proyecto ReneFULL — datos y demanda

Este directorio contiene la parte de **Node.js + MySQL 8** del backend que
trabaja Ismael: esquema, migraciones, carga de los cinco conjuntos simulados de
demostración, consultas internas, estadísticas y modelo de demanda. La API HTTP
con **Express**, la autenticación y las rutas pertenecen al área de Mia-Paola;
este paquete no las reimplementa, pero expone las consultas y el formato de
salida que la API puede consumir.

> Los cinco JSON de `data/demo/` son **datos simulados de demostración**. No son
> ventas reales, no se presentan como tales y no deben usarse para decisiones de
> negocio.

## Requisitos

- Node.js 20.12 o superior.
- MySQL 8.0.
- Los cinco archivos de `data/demo/` (100 ventas cada uno).

## Instalación

Desde `Backend/`:

```bash
npm install
```

Copie `.env.example` a `.env` y ajuste las variables `DB_*`. El archivo `.env`
está excluido de Git; no incluya contraseñas ni secretos en el repositorio.

## Base de datos

```bash
npm run db:migrar
```

El comando crea la base `DB_NOMBRE` si el usuario tiene permiso y aplica las
migraciones pendientes de `db/migraciones/`. La migración inicial crea
`usuarios`, `productos`, `importaciones`, `ventas` y `migraciones`, con claves,
índices y restricciones. El detalle está en
[`docs/ESQUEMA_MYSQL.md`](docs/ESQUEMA_MYSQL.md).

## Cuenta y catálogo de demostración

La cuenta demo se crea sin guardar la contraseña en el repositorio:

```powershell
$env:DEMO_PASSWORD='una-contraseña-local'
npm run demo:cuenta
```

En Bash:

```bash
DEMO_PASSWORD='una-contraseña-local' npm run demo:cuenta
```

El correo y el nombre se configuran con `DEMO_EMAIL` y `DEMO_NOMBRE`. La carga
crea el catálogo de productos a partir de los JSON y lo asocia a la cuenta
cliente.

## Carga de los cinco conjuntos

```bash
npm run demo:cargar
```

La carga:

- valida metadatos, fechas, códigos de texto, productos, categorías, cantidades,
  precios y totales antes de abrir la transacción;
- conserva `producto_id` como texto (`B003`) y el código de origen
  (`D01-066`) en `ventas.id_origen`;
- conserva el precio histórico de cada venta;
- registra la fuente en `importaciones` con hash SHA-256;
- es idempotente: repetirla no duplica ventas;
- revierte la transacción completa si MySQL falla durante la inserción.

Resultado esperado de la carga de demostración:

- 5 archivos;
- 500 ventas;
- 1,287 unidades;
- 36,404.00 MXN.

Los detalles de proceso y errores están en
[`docs/PROCESOS_MYSQL.md`](docs/PROCESOS_MYSQL.md) y
[`docs/VALIDACIONES_MYSQL.md`](docs/VALIDACIONES_MYSQL.md).

## Consultas y modelo

Las consultas filtran por propietario y validan cada fila contra el catálogo
antes de calcular estadísticas o alimentar el modelo. Las filas inválidas se
excluyen y se reportan; una consulta individual inválida produce un error
controlado.

El modelo de demanda:

- agrega unidades por semana y categoría;
- entrena una regresión Ridge en JavaScript;
- evalúa en orden cronológico contra la línea base de la semana anterior;
- usa MAE como métrica interpretable;
- si no hay historial suficiente o el modelo no supera la línea base, devuelve
  un estado controlado sin valores inventados.

La interfaz exacta para Mia-Paola está en
[`docs/INTERFAZ_MIA.md`](docs/INTERFAZ_MIA.md).

## Pruebas

Con una instancia MySQL desechable configurada por variables de entorno:

```powershell
$env:DB_HOST='127.0.0.1'
$env:DB_PUERTO='3306'
$env:DB_USUARIO='root'
$env:DB_CONTRASENA=''
$env:TEST_DB_NOMBRE='proyectorenefull_test'
npm test
```

Las pruebas de integración crean y eliminan únicamente la base
`TEST_DB_NOMBRE`. No usan la base de desarrollo ni datos reales.

Resultado verificado: **21 pruebas aprobadas** (12 unitarias y 9 de integración
con MySQL 8).

## Estructura

```text
Backend/
  data/demo/                 Cinco JSON simulados
  db/migraciones/            Migraciones SQL ejecutables
  db/esquema.sql             Copia de referencia del esquema
  src/config/                Configuración por variables de entorno
  src/db/                    Pool, transacciones y migrador
  src/datos/                 Validación, carga, consultas y cuentas
  src/ml/                    Ridge y modelo de demanda semanal
  scripts/                   Comandos de migración, cuenta y carga
  pruebas/datos/             Pruebas unitarias y de integración
  docs/                      Contrato y documentación de la implementación
```
