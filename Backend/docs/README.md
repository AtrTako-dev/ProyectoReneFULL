# Documentación del backend

Implementación vigente: **Node.js + Express + MySQL 8**. La API, la
autenticación y la capa de datos comparten el mismo esquema y el mismo contrato
de respuestas. La referencia histórica PostgreSQL/FastAPI ya no forma parte de
esta rama.

| Documento | Contenido |
|---|---|
| [`API_CONTRACT.md`](API_CONTRACT.md) | Contrato estable de rutas, DTOs, validaciones, esquema y decisiones. |
| [`ESQUEMA_MYSQL.md`](ESQUEMA_MYSQL.md) | Diccionario físico, llaves, índices y restricciones del DDL MySQL. |
| [`PROCESOS_MYSQL.md`](PROCESOS_MYSQL.md) | Instalación, migración, cuentas, carga demo, ejecución y pruebas. |
| [`VALIDACIONES_MYSQL.md`](VALIDACIONES_MYSQL.md) | Validaciones de entrada, de filas leídas y restricciones de MySQL. |

Los cinco archivos de `../data/demo/` son datos simulados de demostración. No
son ventas reales.
