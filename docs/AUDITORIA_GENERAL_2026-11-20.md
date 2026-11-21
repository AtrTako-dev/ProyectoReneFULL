# More Stock — Auditoría general

**Fecha:** 20 de noviembre de 2026  
**Alcance:** Backend, persistencia MySQL, aplicación Android, configuración de compilación y preparación de despliegue.

## Resultado

La suite local del backend pasó completa y la aplicación Android compila en sus variantes `debug` y `release`. `lint` terminó sin errores. La app se conectó desde un emulador API 36 a la API local y a la base aislada, inició y cerró sesión, cargó negocios, productos, inventario y recomendaciones, y mostró el pronóstico de un producto.

Esto valida el recorrido Android–API–MySQL local. No verifica una conexión con TiDB Cloud ni una publicación en Render.

## Correcciones realizadas

- Los errores inesperados del modelo de pronóstico ya no se convierten en una respuesta 422 de historial insuficiente. Ese 422 se reserva para series sin cuatro semanas consecutivas y se identifica con `INSUFFICIENT_SALES_HISTORY`.
- Se corrigió un `ReferenceError` en la explicación de recomendaciones: la evidencia ahora conserva el método del pronóstico con el nombre correcto.
- Android ahora distingue cancelaciones de errores de carga; reabrir el mismo negocio/producto no permite que una consulta vieja cierre el indicador de la nueva. Cambiar de pestaña limpia también el estado del pronóstico cancelado.
- El ViewModel depende de `MoreStockDataSource`, lo que permite probar carreras de carga con una fuente controlada.
- La barra de navegación Android usa una configuración compatible con API 26; el tema claro para la barra se aplica desde API 27.
- Las pruebas MySQL requieren `RUN_MYSQL_PERSISTENCE_TESTS=true`, host local y una base terminada en `_test`. Un lock MySQL evita ejecuciones simultáneas y el cleanup intenta completar todos sus pasos aunque falle uno.
- Las pruebas de inventario restauran cantidad, origen y `updated_at`; se agregaron pruebas de errores de pronóstico y cinco pruebas Android de cancelación/navegación.

## Verificaciones ejecutadas

| Verificación | Resultado |
|---|---|
| Backend: `RUN_MYSQL_PERSISTENCE_TESTS=true DB_NAME=more_stock_codex_test npm test -- --test-concurrency=1` | 22 aprobadas, 0 fallidas, 0 omitidas |
| Pruebas MySQL en `more_stock_codex_test` | 7 aprobadas; se creó una base local aislada para esta ejecución |
| Auditoría npm de dependencias de producción | 0 vulnerabilidades reportadas |
| Sintaxis JavaScript de `Backend/src` con `node --check` | Correcta en todos los archivos revisados |
| Android: `lint` | 0 errores; 9 advertencias |
| Android: `testDebugUnitTest` | 5 pruebas aprobadas |
| Android: `assembleDebug` y `assembleRelease` | Ambas variantes compiladas correctamente; release quedó sin firmar |
| Emulador Android API 36 + API local | Login, lista y selección de negocio, inventario, recomendaciones, detalle/pronóstico y logout correctos; sin excepción fatal observada |

El recorrido HTTP de la API devolvió 200 para login, negocios, productos, inventario, recomendaciones y pronóstico; logout devolvió 204. La app cargó 10 productos, 10 inventarios y 10 recomendaciones del negocio demo probado.

Las advertencias de `lint` corresponden a versiones más recientes disponibles, `targetSdk` 35, configuración de respaldo, un recurso sin uso y la falta de icono de aplicación. No impidieron la compilación. La última pasada Gradle usó `-Xmx1024m` temporalmente porque la pasada simultánea con memoria predeterminada falló por falta de heap; no se cambió `gradle.properties`.

## Efectos de la primera corrida de integración

Antes de aislar las pruebas, la suite también pasó una vez contra la base configurada para uso local. Esa inicialización pudo crear o ajustar tablas, completar datos demo, guardar el artefacto de pronóstico y eliminar sesiones ya vencidas de esa base. Las pruebas restauraron las ventas y cantidades que modificaron, pero esa primera versión de las pruebas no restauraba `updated_at`; el contador `AUTO_INCREMENT` de movimientos también pudo avanzar. No se ejecutaron `DROP` ni `TRUNCATE`, y no se puede recuperar el conteo anterior de sesiones vencidas.

La base nueva `more_stock_codex_test` queda disponible localmente con su esquema y datos demo de prueba. Las siguientes corridas de persistencia deben apuntar a esa base y usar la habilitación explícita documentada en [Backend/README.md](../Backend/README.md).

## Pendientes para una integración o publicación real

- No se verificó una conexión TLS contra TiDB. Hay que confirmar el tipo de clúster; TiDB Dedicated requiere configurar la CA del clúster según la [documentación oficial de TLS](https://docs.pingcap.com/tidbcloud/tidb-cloud-tls-connect-to-dedicated/).
- No se creó ni publicó un servicio de Render. El Blueprint mantiene los despliegues automáticos apagados y necesita credenciales y un clúster accesible.
- El `release` compilado quedó sin firmar y contiene la dirección HTTP local `10.0.2.2`; como la variante bloquea HTTP sin cifrar, no conectará con esa configuración. Debe generarse de nuevo con la URL HTTPS real mediante `morestock.apiBaseUrl` antes de distribuirlo.
- Antes de exponer el servicio públicamente conviene agregar límites de intentos al inicio de sesión. La revisión fue estática; no se ejecutó un pentest externo.
- El proyecto no tiene metadatos Git utilizables en esta copia, por lo que no fue posible generar un diff contra una revisión base.
