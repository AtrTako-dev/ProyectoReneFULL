# Informe de rediseño UX/UI de More Stock para Android

**Fecha de revisión:** 25 de noviembre de 2026

**Rama:** `ux-redesign`

## Resumen

Se rediseñaron las pantallas Compose de More Stock para presentar con mayor claridad inventario y recomendaciones a comerciantes. El trabajo conservó Kotlin, Jetpack Compose, Material 3 y MVVM. No se modificaron Backend, contratos de API, DTO, reglas de negocio, datasets, base de datos ni archivos `.env`; tampoco se agregaron dependencias ni se generó una versión release.

La verificación automática final terminó correctamente con **36 pruebas unitarias aprobadas, 0 errores de lint y compilación debug exitosa**. La revisión visual autenticada y algunas comprobaciones de accesibilidad no pudieron completarse porque el emulador API 36 permaneció en estado de arranque y no se recibió una cuenta demo con usuario y contraseña.

## Decisiones de diseño

| Decisión | Razón |
| --- | --- |
| Mostrar las recomendaciones como texto, icono y color | La decisión sigue siendo comprensible sin distinguir colores. |
| Poner los productos COMPRAR primero en el resumen | Responde primero a la pregunta práctica de qué necesita atención. |
| Usar búsqueda, categoría, recomendación y orden en el catálogo | Permite encontrar productos sin cambiar datos ni reglas del servidor. |
| Mantener la unidad junto a la cantidad de inventario | Reduce confusiones entre kg, piezas, cajas y otras unidades. |
| Comprobar el inventario antes del guardado y conservar el borrador si cambió | Evita sobrescribir cambios detectables y permite revisar el valor más reciente sin perder lo escrito. |
| Dibujar el historial con línea sólida y el pronóstico con línea discontinua | Diferencia ventas registradas de estimaciones; la leyenda también lo explica. |
| Usar un panel Cuenta con correo, negocio activo, rol, cambio de negocio y salida confirmada | Reúne la información de sesión y evita cerrar por accidente. |
| Usar listas desplazables, diálogos desplazables y semántica de estado | Da más espacio al contenido y mejora la compatibilidad con pantallas compactas y lectores de pantalla. |

## Sistema de diseño

El tema usa la tipografía del sistema y una escala Material 3 definida en `MoreStockTheme.kt`. Los estilos principales son: cuerpo 16/24 sp y 14/20 sp, texto secundario 12/18 sp, títulos de 14 a 28 sp y encabezados hasta 32 sp. Las formas y el espaciado se comparten desde `MoreStockTheme`.

| Rol | Tema claro | Tema oscuro |
| --- | --- | --- |
| Primario | `#0C6B54` | `#8DD6BF` |
| Fondo | `#F5F7F4` | `#101512` |
| Superficie | `#FFFFFF` | `#171D19` |
| COMPRAR | Fondo `#D2F1E7`, texto `#063B30`, icono `#0C6B54` | Fondo `#164E3A`, texto `#B7F7D5`, icono `#8DD6BF` |
| MANTENER | Fondo `#FFF1C2`, texto `#684500`, icono `#815A00` | Fondo `#57410B`, texto `#FFE49A`, icono `#FFD267` |
| NO_COMPRAR | Fondo `#FCE8E6`, texto `#8D1D1D`, icono `#BA1A1A` | Fondo `#5A2525`, texto `#FFC5C1`, icono `#FFB4AB` |

Entre los componentes reutilizables están `ProductCard`, `RecommendationBadge`, `MetricCard`, `ValidatedTextField`, los estados de carga/vacío/error, `SyntheticDataBanner`, `BusinessHeader`, el editor de inventario, `ProfilePanel` y `ForecastChart`.

## Cambios por pantalla

- **Acceso y registro:** validación en línea, mostrar/ocultar contraseña, teclado y acciones IME adecuados, espera informada ante HTTP 429 y mensajes de error accesibles.
- **Selección de negocio:** tarjetas con negocio y rol, más confirmación al cerrar sesión.
- **Resumen y productos:** productos COMPRAR aparecen antes de las métricas; el catálogo permite buscar, filtrar y ordenar sin comparar cantidades de unidades distintas.
- **Inventario:** editor numérico con unidad visible, validación por unidad conocida, confirmación al guardar y detección de cambios remotos antes del PUT. Si el servidor devuelve una unidad distinta, el usuario debe confirmarla; el número escrito se conserva.
- **Pronóstico y recomendación:** decisión con icono y texto, explicación completa recibida, cifras de planificación con unidades, métricas cuando existen, advertencia de datos sintéticos cuando la API la envía, y gráfica interactiva con alternativa textual.
- **Cuenta y navegación:** correo, negocio activo y rol; cambio de negocio; salida confirmada; pestañas con icono y etiqueta.
- **Accesibilidad:** regiones vivas para mensajes, acciones accesibles en la gráfica, colores comprobados y etiquetas de navegación que no ocupan varias líneas.

## Capturas

Las capturas iniciales reales del acceso están en [`docs/ui/antes/`](ui/antes/): `login.png` y `login-validacion-correo.png`. También hay imágenes de ANR que documentan fallos del emulador; no representan pantallas de More Stock.

Las capturas posteriores reales disponibles están en [`docs/ui/despues/`](ui/despues/): `login.png` y `registro.png`. Se obtuvieron durante U4 y esas pantallas de acceso no cambiaron visualmente después. No hay capturas autenticadas posteriores de resumen, catálogo, inventario, Cuenta, recomendaciones o gráfica; no se presentan previews como capturas reales.

## Verificación

La última corrida completa se ejecutó desde `FrontEnd/`:

```sh
GRADLE_USER_HOME=/tmp/morestock-gradle-home ./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
```

| Comprobación | Resultado |
| --- | --- |
| `testDebugUnitTest` | 36 aprobadas; 0 fallidas; 0 omitidas |
| `lintDebug` | 0 errores y 9 advertencias |
| `assembleDebug` | Correcto |
| Contraste | Pruebas de texto ≥ 4.5:1 y de iconos/trazos ≥ 3:1 en las paletas claro y oscuro |
| API local | En la fase inicial se comprobó `/api/v1/health` contra `more_stock_codex_test` |
| Emulador | Intento U9 no completó el arranque; `adb install` respondió `device is still booting` |
| Recorrido autenticado | Pendiente; faltó una cuenta demo utilizable y el emulador no terminó de iniciar |

Después se aumentó el límite de heap y metaspace del daemon en `FrontEnd/gradle.properties` para evitar la presión de memoria reportada por Gradle. La recompilación `:app:assembleDebug` finalizó correctamente en 26 s sin repetir ese aviso.

Las nueve advertencias de lint corresponden a versiones más nuevas disponibles de Gradle, Android Gradle Plugin, Compose, Lifecycle y Kotlin; nivel objetivo de Android; nomenclatura de composables existente; reglas de respaldo y carpeta de iconos asociada al nivel mínimo. No impidieron la compilación.

La app no se recorrió con TalkBack ni se midieron objetivos táctiles renderizados. Tampoco se verificaron en ejecución texto al 200 %, pantalla de 360 × 640 dp, orientación horizontal o contraste visual de ambas paletas. El detalle de estas limitaciones está en [`docs/ui/ACCESIBILIDAD.md`](ui/ACCESIBILIDAD.md).

## Cómo abrir la app y ubicación del APK

La guía con comandos locales está en [`docs/ui/GUIA_VER_LA_APP.md`](ui/GUIA_VER_LA_APP.md). El APK debug recién compilado está en:

`FrontEnd/app/build/outputs/apk/debug/app-debug.apk`

Los comandos de `testDebugUnitTest`, `lintDebug` y `assembleDebug` están en [`FrontEnd/README.md`](../FrontEnd/README.md). El APK es una variante debug, firmada con la clave de depuración; no está firmada con una clave de publicación ni preparada como release.

## Límites y propuestas

- El GET previo al PUT detecta cambios ocurridos antes de esa lectura, pero la API no expone una versión de inventario ni una actualización condicional. Una modificación remota en el breve intervalo entre GET y PUT todavía podría ganar la carrera. Una versión o ETag en el contrato permitiría bloquearla de forma atómica.
- La respuesta de pronóstico no incluye un estado estructurado de “historial insuficiente” o “modelo no disponible”, ni datos de temporada o stock de seguridad por separado. La pantalla presenta solo los campos que sí recibe y mantiene neutrales los mensajes cuando faltan puntos.
- No se añadieron dependencias de gráficas ni de pruebas visuales. La gráfica usa Canvas; las pruebas agregadas son JVM para reglas de presentación y ViewModel.
- Las pantallas autenticadas y las comprobaciones manuales de accesibilidad requieren una nueva ejecución con un emulador que complete el arranque y una cuenta demo. No se crearon cuentas ni se modificó la base de datos durante esta fase.

## Commits de implementación anteriores

- `e32a1a8` — auditoría UX y guía local.
- `8b97b4c` — sistema de diseño Android.
- `7c67eec` — acceso y selección de negocio.
- `acdbd77` — resumen y catálogo.
- `a72ac61` — editor de inventario.
- `bb4b3ed` — pronóstico, recomendación y gráfica.
- `cd4d3b6` — cuenta y salida confirmada.
- `d20e5c8` — checklist de accesibilidad.
