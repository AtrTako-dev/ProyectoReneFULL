# More Stock — Informe de cierre de Fase 9

**Fecha:** 20 de noviembre de 2026
**Alcance:** limpieza del repositorio, revisión de ML, seguridad del backend, calendario, Android y documentación local. No se desplegó la API ni se conectó a TiDB.

## Cambios por tarea

| Tarea | Resultado |
|---|---|
| T1. Limpieza y Git | Se eliminó el volcado `FrontEnd/java_pid23619.hprof` de 769 MB, se agregaron reglas de exclusión en los `.gitignore` y se reinició la rama `main` con la versión del proyecto. Los CSV originales no se modificaron. |
| T2. Pruebas de ML | Se añadieron pruebas para variables pasadas, cronología, fuga, entrenamiento, métricas, serialización, error de historial y selección del método. |
| T3. Evaluación temporal | Se separaron fechas en entrenamiento, validación y prueba, con cortes compartidos por unidad. El método se selecciona por MAE de validación; la prueba informa MAE y WAPE sin cambiar esa selección. |
| T4. Intentos de login | Se agregó un límite configurable en memoria por correo normalizado e IP, respuesta 429 con `Retry-After`, reinicio tras éxito, limpieza periódica y máximo de 10,000 claves. |
| T5. Calendario | Black Friday y Cyber Monday se calculan por regla; Buen Fin mantiene las fechas oficiales de 2023–2026. Para 2027 no se inventa una fecha. |
| T6. ViewModel Android | Se añadieron pruebas de login, errores, carga, estado vacío, actualización válida e inválida del inventario y recarga. La actualización se expone en el ViewModel y el repositorio/API. |
| T7. Entrega Android | Se agregó un icono adaptativo propio, mensaje de timeout con reintento y tiempos de conexión/lectura de 15/75 segundos. Se eliminó el recurso sin uso que señalaba lint. |
| T8. Interfaz | Las recomendaciones muestran estado, cantidad, explicación del backend y marca sintética cuando corresponde. El detalle separa pronóstico semanal e historial. Las únicas referencias al nombre anterior fuera de los datos son rutas literales del dataset que se conserva. |
| T9. Documentación | Se actualizaron los informes y README, se creó este informe, el guion de exposición y la lista de pendientes de despliegue. |

## Evaluación final del modelo

La corrida usa `SalesCsvRepository` y `ForecastService.initialize()` sobre los CSV sintéticos. Contiene 50 series y 2,300 ejemplos evaluables: 1,300 para entrenamiento, 500 para validación y 500 para prueba. No utiliza MySQL ni persiste el artefacto. El comando reproducible está en [`FASE_5_INFORME.md`](FASE_5_INFORME.md).

| Unidad | Entrenamiento | Validación | Prueba | Método seleccionado en validación | MAE de prueba | WAPE de prueba |
|---|---:|---:|---:|---|---:|---:|
| kg | 260 | 100 | 100 | Promedio móvil de 4 semanas | 2.8550 | 13.5629 % |
| paquete | 156 | 60 | 60 | Random Forest | 6.8046 | 13.1702 % |
| pieza | 572 | 220 | 220 | Random Forest | 7.5238 | 25.4809 % |
| bolsa | 78 | 30 | 30 | Random Forest | 2.6743 | 10.0287 % |
| botella | 78 | 30 | 30 | Random Forest | 3.4562 | 19.6375 % |
| lata | 52 | 20 | 20 | Random Forest | 2.5130 | 13.1569 % |
| envase | 52 | 20 | 20 | Random Forest | 3.3042 | 13.6538 % |
| caja | 26 | 10 | 10 | Última semana | 5.8000 | 25.2174 % |
| juego | 26 | 10 | 10 | Última semana | 3.9000 | 20.3125 % |

La validación elige el método. En algunas unidades una línea base obtiene menor error en el bloque de prueba; el procedimiento no cambia la selección después de observarlo. Diez observaciones por serie en prueba son evidencia limitada, no cubren un año semanal y no representan ventas reales.

## Verificación final local (T10)

La suite de backend se ejecutó desde `Backend/` con persistencia MySQL habilitada solo para la base local aislada `more_stock_codex_test`:

```sh
RUN_MYSQL_PERSISTENCE_TESTS=true DB_NAME=more_stock_codex_test npm test -- --test-concurrency=1
find src test -type f -name '*.js' -print0 | xargs -0 -n1 node --check
npm audit --omit=dev
```

La verificación Android se ejecutó desde `FrontEnd/` con repetición forzada de las tareas:

```sh
GRADLE_USER_HOME=/tmp/morestock-gradle-home ./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug --rerun-tasks
```

| Verificación | Resultado observado |
|---|---|
| Backend | 51 pruebas aprobadas, 0 fallidas y 0 omitidas; incluyó login, inventario, recomendaciones, membresías, permisos y persistencia MySQL. La corrida tardó 116.4 s. |
| Sintaxis JavaScript | `node --check` terminó sin errores para todos los archivos `.js` de `src/` y `test/`. |
| Dependencias de producción | `npm audit --omit=dev`: 0 vulnerabilidades reportadas. |
| Android | `:app:testDebugUnitTest`: 15 pruebas, 0 fallidas. `:app:lintDebug`: 0 errores y 8 advertencias. `:app:assembleDebug`: compilación correcta; APK de 11,812,034 bytes. Las tareas se forzaron para volver a ejecutarse. |
| Emulador | `adb devices -l` no mostró dispositivos conectados; no se hizo recorrido visual automatizado en Android. |
| Llamadas de red en Compose | Búsqueda estática sin llamadas HTTP en `ui/`; la conexión está en el paquete `data/`. |
| Marca anterior | Búsqueda sin menciones en prosa o identificadores; quedan solo en rutas literales al dataset original. |

Las ocho advertencias Android restantes incluyen avisos de versiones, `targetSdk` y reglas de respaldo, además del calificador `-v26` del icono. Se mantuvo `-v26` porque Android reconoce el recurso de icono adaptativo allí y AAPT no encontró `@mipmap/ic_launcher` al moverlo a `mipmap-anydpi`. La advertencia de icono faltante y la de recurso sin uso ya no aparecen.

## Efectos fuera del código y datos protegidos

- Se eliminó el archivo generado `FrontEnd/java_pid23619.hprof` de 769 MB y cualquier otro volcado `.hprof` localizado dentro del proyecto.
- Se conservaron sin editar los CSV originales, incluido el directorio del dataset.
- `.env` permanece fuera de Git. No se leyó, copió ni publicó su contenido.
- Las pruebas de persistencia se limitan a `more_stock_codex_test`; no se ejecuta `DROP`, `TRUNCATE` ni un borrado sin condición.
- Se modificó la historia de `main` y se eliminaron las ramas y etiquetas antiguas del repositorio remoto antes de publicar la versión nueva. GitHub conserva referencias administradas a los PR existentes, que no se borran con un push a `main`.

## Límites conocidos

- Los datos y métricas de ML son sintéticos y deben reemplazarse/reevaluarse con ventas autorizadas antes de tomar decisiones reales.
- El bloque de prueba es pequeño; la evaluación mide un paso rodante y no garantiza el error de un pronóstico único para diez semanas.
- El limitador de login es local a un proceso, se borra al reiniciar y no coordina varias instancias.
- El método de actualización de inventario está disponible desde el ViewModel y la API Android, pero todavía no tiene un control de edición en Compose.
- La app no presenta ventas semanales directas ni una gráfica dibujada; el backend sí entrega los puntos históricos y futuros, que Android presenta en listas con rótulos distintos.
- El APK release HTTPS firmado, la creación del clúster TiDB, la verificación de su CA, la configuración del servicio Render y el despliegue quedan pendientes. Consulta [`PENDIENTES_DESPLIEGUE.md`](PENDIENTES_DESPLIEGUE.md).

## Skills y revisiones

Se aplicaron las Skills pertinentes de Superpowers (TDD, depuración, planes, verificación y revisión), Karpathy, diseño del código y dominio, investigación, revisión de calidad y documentación. Cada bloque de implementación de T3–T8 recibió una revisión independiente antes de cerrarse.

La versión de cierre se mantiene en `main`. Los cambios de esta fase se publican en el repositorio autorizado después de completar las verificaciones; no se desplegó el backend ni se publicó el APK release.
