# Alineación con la API de Mia-Paola

Registro de la verificación realizada contra la versión remota
`origin/Mia-Paola` (`260bf01`). La rama `Ismael` usa ese contrato como fuente de
verdad y no mantiene una segunda API ni un segundo esquema.

## 1. Alcance verificado

| Componente | Estado |
|---|---|
| `Backend/docs/API_CONTRACT.md` | Contrato de Mia conservado; solo se actualizó el estado del esquema y la documentación de verificación. |
| `Backend/src/rutas/` | Idéntico a `origin/Mia-Paola`. |
| `Backend/src/controladores/` | Idéntico a `origin/Mia-Paola`. |
| `Backend/src/modelos/` | Idéntico a `origin/Mia-Paola`. |
| `Backend/src/validaciones/` | Idéntico a `origin/Mia-Paola`. |
| `Backend/src/servicios/estadisticas.js`, `prediccion.js`, `registros.js` | Idénticos a `origin/Mia-Paola`. |
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

Resultado: **112 pruebas unitarias/HTTP aprobadas**.

```powershell
$env:DB_PUERTO='3306'
$env:DB_USUARIO='root'
$env:DB_CONTRASENA=''
$env:TEST_DB_NOMBRE='proyectorenefull_test'
npm run test:integracion
```

Resultado: **9 pruebas de integración MySQL aprobadas** con MySQL 8.0.46. La
base se crea y se elimina en la misma ejecución; las pruebas cubren migración,
tipos del contrato, FK compuesta, rollback, carga demo, idempotencia,
aislamiento, estadísticas, modelo Ridge y flujos HTTP reales.

## 4. Regla para cambios futuros

Si Mia cambia el contrato, primero se actualiza `API_CONTRACT.md` y después el
DDL, los modelos, los DTOs y las pruebas en la misma rama. No se agrega una capa
paralela para evitar dos formatos de respuesta incompatibles.
