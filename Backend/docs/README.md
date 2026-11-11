# Documentación del backend

La documentación de esta rama cubre la base de datos, los procesos y las
validaciones del backend. Las rutas HTTP, la autenticación y la aplicación móvil
se integran en otras ramas.

| Documento | Contenido |
| --- | --- |
| `CONTRATO_BACKEND.md` | Contrato aprobado de base de datos, consultas y Machine Learning. |
| `MODELO_DATOS.md` | DER, modelo relacional, diccionario de datos y normalización. |
| `PROCESOS.md` | Procesos, decisiones, transacciones y manejo de errores. |
| `VALIDACIONES.md` | Catálogo de validaciones y trazabilidad con las pruebas. |

## Orden de lectura

1. `CONTRATO_BACKEND.md`: alcance, stack y acuerdos con las otras ramas.
2. `MODELO_DATOS.md`: estructura persistente y reglas de integridad.
3. `PROCESOS.md`: flujo de registro, carga, consulta, administración y
   predicción.
4. `VALIDACIONES.md`: reglas concretas, errores y pruebas que las cubren.

## Comandos de verificación

```powershell
cd Backend
alembic upgrade head
alembic check
pytest
```

Las pruebas requieren una base PostgreSQL desechable configurada en
`TEST_DATABASE_URL`. Nunca se debe apuntar a una base con datos reales.
