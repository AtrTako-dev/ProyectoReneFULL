# Alineación con la API de Mia-Paola

Registro de la verificación realizada contra la versión remota
`origin/Mia-Paola` (`e2b8af3`, con las correcciones `60154c2` y `e2b8af3`). La
rama `Ismael` integró esos commits mediante un merge `--no-ff` (`44d0c6f`) y usa
ese contrato como fuente de verdad; no mantiene una segunda API ni un segundo
esquema.

## 1. Alcance verificado

| Componente | Estado |
|---|---|
| `Backend/docs/API_CONTRACT.md` | Contrato de Mia conservado; solo se actualizó el estado del esquema y la documentación de verificación. |
| `Backend/src/rutas/` | Idéntico a `origin/Mia-Paola`. |
| `Backend/src/controladores/` | Idéntico a `origin/Mia-Paola`. |
| `Backend/src/modelos/` | Idéntico a `origin/Mia-Paola`. |
| `Backend/src/validaciones/` | Idéntico a `origin/Mia-Paola`. |
| `Backend/src/servicios/estadisticas.js`, `prediccion.js`, `registros.js` | Idénticos a `origin/Mia-Paola`. |
| `Backend/src/servicios/cargaDemo.js` | Protecciones propias de Ismael: catálogo inmutable, propietario y concurrencia. |
| `Backend/src/middleware/errores.js` | Conserva la traducción de `ER_CHECK_CONSTRAINT_VIOLATED` a `422` sin filtrar mensajes de MySQL. |
| Predicción | Conserva las 10 observaciones / 14 semanas completas efectivas de Mia. |
| Capa de datos de Ismael anterior | Retirada (`src/datos`, `src/ml`, `src/db/mysql.js`, `src/config/entornoDatos.js`). |
| DDL MySQL | Implementado en `db/migraciones/001_esquema_inicial.sql`. |

Los cambios propios de Ismael se limitan a la configuración del entorno, el pool
y el runner de migraciones, la carga demo, el empaquetado y la documentación.

## 2. Contrato de datos compartido

- Identidad de usuario: UUID de 36 caracteres en minúsculas, `CHAR(36)`.
- Correo en la columna `correo`; la entrada HTTP conserva `email` y la salida usa
  `correo`.
- `ventas.id` es la clave interna numérica; `ventas.id_origen` conserva el
  `id_venta` textual del archivo.
- `ventas.propietario_id` es UUID y sustituye a `usuario_id`.
- `productos.id` es texto con patrón `^[A-Z]{1,3}[0-9]{3}$`.
- La relación producto-categoría es `productos.categoria_id → categorias.id`.
- `ventas` e `importaciones` comparten la FK compuesta
  `(importacion_id, propietario_id)`.
- Las respuestas de error usan la envoltura
  `{ error: { codigo, mensaje, campos? } }`.
- La predicción publica `tipo_resultado` y no devuelve valores cuando el estado
  es `sin_historial_suficiente` o `modelo_no_supera_linea_base`.

## 3. Verificación reproducible

```bash
npm test
```

Resultado: **121 pruebas unitarias/HTTP aprobadas**, sin conexión a MySQL.

```powershell
$env:DB_PUERTO='3306'
$env:DB_USUARIO='root'
$env:DB_CONTRASENA=''
npm run test:integracion
```

Resultado: **17 pruebas de integración MySQL aprobadas** con MySQL 8.0.46. La
base temporal debe llevar el prefijo `renefull_test_`; solo se elimina la base
creada por el proceso actual. Las pruebas cubren migración, hashes y variantes
CRLF/LF, esquema preexistente incompatible, registro histórico de `001`, tipos
del contrato, FK compuesta, rollback, carga demo, catálogo inmutable, producto
inactivo, propietario distinto, conflicto concurrente, idempotencia, aislamiento,
estadísticas, modelo Ridge y flujos HTTP reales.

## 4. Regla para cambios futuros

Si Mia cambia el contrato, primero se actualiza `API_CONTRACT.md` y después el
DDL, los modelos, los DTOs y las pruebas en la misma rama. No se agrega una capa
paralela para evitar dos formatos de respuesta incompatibles.
