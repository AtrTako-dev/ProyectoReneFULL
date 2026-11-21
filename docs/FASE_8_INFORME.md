# More Stock — Informe de Fase 8

**Fecha:** 20 de noviembre de 2026  
**Alcance:** preparación para integración y entrega, revisión estática de seguridad y configuración local de despliegue.

## Resultado

Se dejó un Blueprint local para Render en `render.yaml`, con la API ubicada en `Backend/`, compilación desde el lockfile, inicio con `npm start`, chequeo HTTP y despliegue automático desactivado. Los secretos de conexión se solicitan fuera del archivo; el servicio usa TLS hacia TiDB, mantiene `DEMO_MODE=false` y no inserta datos demo en producción.

La conexión MySQL ahora solicita TLS 1.2 como mínimo cuando `DB_SSL=true`. Android permite establecer la URL HTTPS de producción mediante la propiedad Gradle `morestock.apiBaseUrl`; la URL predeterminada sigue siendo la del emulador local. Se documentaron los pasos y las condiciones pendientes en `Backend/README.md` y `FrontEnd/README.md`.

## Revisión estática

- `.env` está excluido por `Backend/.gitignore`; las credenciales locales no se copiaron al Blueprint ni a la documentación.
- El arranque de producción no habilita el modo de demostración ni crea cuentas demo.
- Las rutas de negocios requieren autenticación y verifican la membresía del usuario en el negocio solicitado.
- Las contraseñas se almacenan como hash y las sesiones se guardan mediante un resumen del token con vencimiento.
- Las respuestas de error interno no exponen el detalle de excepciones.
- El chequeo `/api/v1/health` confirma disponibilidad del proceso HTTP; no comprueba conexión vigente con MySQL.
- En el corte original de Fase 8 todavía no había limitación de intentos de inicio de sesión. La Fase 9 agregó un limitador en memoria; sus límites de un solo proceso siguen vigentes y están descritos en `Backend/README.md`.

## Verificación final

| Tarea | Estado |
|---|---|
| F8.1 Integración Backend–Android–DB local | Recorrido local aprobado: login, negocio, productos, inventario, recomendaciones y pronóstico; suite completa 22/22 con siete pruebas MySQL en una base aislada terminada en `_test`. |
| F8.2 Revisión de seguridad y documentación | Revisión estática y auditoría npm completadas; npm reportó 0 vulnerabilidades en dependencias de producción. |
| F8.3 Preparación de despliegue | Blueprint y requisitos documentados; no se creó un servicio ni se publicó la API. |

Android `lint` terminó con 0 errores y 9 advertencias; `assembleDebug` y `assembleRelease` compilaron correctamente. Las cinco pruebas unitarias Android pasaron. En API 36, la app se conectó al servidor local, mostró productos, inventario, recomendaciones y el pronóstico, y cerró sesión correctamente.

Durante la integración local se usó `more_stock_codex_test`, nunca la base de desarrollo. La primera corrida anterior de pruebas MySQL se hizo contra la base configurada para desarrollo y pudo crear/ajustar tablas, completar datos demo, eliminar sesiones vencidas y dejar cambios de `updated_at`. Después se agregó protección por host local, nombre `_test`, activación explícita, bloqueo de concurrencia y cleanup más completo. No se ejecutaron `DROP` ni `TRUNCATE`.

El despliegue sigue pendiente de un clúster TiDB accesible, credenciales de un usuario de base con permisos mínimos y cuentas/datos preparados. La integración local Android–API–MySQL ya se comprobó; falta repetirla contra el host y la base de producción, y verificar TLS con el clúster real. La revisión de configuración de Fase 8 se documenta en [docs/AUDITORIA_GENERAL_2026-11-20.md](AUDITORIA_GENERAL_2026-11-20.md) y [docs/FASE_8_RESEARCH.md](FASE_8_RESEARCH.md).

## Actualización tras el cierre de Fase 9

Las filas y cantidades de la tabla anterior reflejan la verificación original de Fase 8. Después se añadieron pruebas automatizadas de ML, evaluación temporal con tres tramos y WAPE, límite de intentos de inicio de sesión, calendario configurable y cobertura adicional de Android. Los resultados vigentes y sus comandos se registran en [FASE_9_INFORME.md](FASE_9_INFORME.md).

La aplicación Android también quedó con icono adaptativo, manejo de tiempos de espera y opción de reintento. Se compilaron las variantes debug; no se firmó ni publicó una versión release. El repositorio Git ya cuenta con la rama `main` reiniciada y commits nuevos por tarea. No se creó un servicio de Render ni se conectó a TiDB.
