# Auditoría de experiencia y accesibilidad

## Alcance y evidencia

Esta revisión describe el estado actual de la aplicación Android antes del rediseño. Se inspeccionaron las pantallas Compose y la configuración del tema, además de dos capturas reales: `antes/login.png` y `antes/login-validacion-correo.png` (1080 × 2400 px). La captura de validación muestra un correo inválido; no representa un error de autenticación del servidor. Solo los hallazgos del login y de su barra de estado tienen evidencia visual directa; los demás hallazgos identifican el archivo y el comportamiento observado en código porque no se pudieron capturar esas pantallas.

El emulador Android 36 ejecutó la aplicación, pero presentó bloqueos de System UI y de la app durante la interacción. No se atribuye ese comportamiento al código de la aplicación ni se usan las capturas del bloqueo como evidencia de diseño. Por esa limitación no se pudieron comprobar visualmente las pantallas después del inicio de sesión, el teclado abierto, TalkBack, áreas táctiles ni tamaños de pantalla alternativos. Los hallazgos siguientes distinguen observaciones de capturas y riesgos detectados por inspección del código.

## Hallazgos priorizados

### Prioridad alta

No se identificó un defecto de prioridad alta que pueda confirmarse con la evidencia disponible. El bloqueo del emulador queda como limitación del entorno; no se registra como defecto de la app sin una reproducción confiable.

### Prioridad media

| Hallazgo | Evidencia | Mejora recomendada |
|---|---|---|
| El botón de inicio de sesión reemplaza el texto «Entrar» por un indicador pequeño durante la carga, y no comunica el estado a lectores de pantalla. | `LoginScreen.kt`; inspección de Compose. | Mantener una etiqueta visible junto al indicador y anunciar el estado de carga mediante semántica accesible. Aplicar el mismo anuncio a estados de carga compartidos. |
| Los errores se muestran debajo del campo de contraseña aunque puedan corresponder al correo, a la contraseña o a la conexión. No tienen anuncio automático accesible. | `antes/login-validacion-correo.png`, `LoginScreen.kt`. | Asociar la validación al campo que la provoca y exponer el error como mensaje accesible. Mantener errores de servidor en un área general identificable. |
| En el resumen, encabezados y tarjetas de métricas quedan fuera de la lista desplazable. En ventanas cortas o con texto grande pueden dejar muy poco espacio para los productos. | `BusinessScreen.kt`; inspección de estructura Compose. | Hacer desplazable el contenido completo de cada pestaña, conservando listas perezosas donde aporten rendimiento. Revisar nombres largos y la barra superior con escalado de texto. |
| La pestaña de recomendaciones muestra el estado, la cantidad sugerida y la explicación. Sin embargo, esa información no aparece desde el resumen ni el catálogo, y el resumen no prioriza los productos que necesitan atención. | `BusinessScreen.kt`; inspección del flujo en código. | Dar prioridad visual en el resumen a los productos con recomendación de compra y permitir abrir su detalle directamente, usando el estado que ya entrega la API. |
| La app siempre fuerza el tema claro, aunque existe una paleta oscura. Activar el tema oscuro sin revisar todos los colores puede dejar texto con contraste insuficiente. | `MainActivity.kt`, `MoreStockTheme.kt`, `LoginScreen.kt`, `values-v27/styles.xml`. | Conectar el tema a la preferencia del sistema y definir colores de contenido para ambas paletas antes de habilitarlo. Verificar barras del sistema y contraste en ambas variantes. |
| En la captura de inicio, los iconos claros de la barra de estado se ven sobre un fondo claro y tienen poco contraste. | `antes/login.png`; observación visual de la captura. | Ajustar el estilo de la barra de estado para que iconos y fondo formen una combinación legible en la pantalla de inicio, y comprobarlo con ambas variantes del tema. |
| El botón «Actualizar» vuelve a seleccionar el negocio y puede restablecer la pestaña actual. Además, el estado de error puede convivir con métricas vacías y el cambio de pestaña lo limpia sin volver a cargar datos. | `BusinessScreen.kt`, `MoreStockViewModel.kt`; inspección de flujo. | Actualizar los datos conservando la pestaña y separar claramente error, carga, vacío y contenido válido. Permitir reintento desde el estado de error sin duplicar acciones. |

### Prioridad baja

| Hallazgo | Evidencia | Mejora recomendada |
|---|---|---|
| Los símbolos decorativos de las tarjetas se pueden leer como texto y las tarjetas interactivas exponen una acción genérica. Los títulos visuales de sección no están marcados semánticamente como encabezados. | `BusinessScreen.kt`, `BusinessesScreen.kt`, `ProductDetailScreen.kt`; inspección de semántica. | Marcar los encabezados semánticamente y ocultar símbolos decorativos de lectores de pantalla. Dar a cada tarjeta interactiva una descripción y acción comprensibles. |
| «Listo» en el teclado no envía el formulario; la actividad tampoco declara `adjustResize` y el contenido no gestiona explícitamente las áreas de las barras del sistema. No se pudo confirmar un solapamiento en ejecución. | `LoginScreen.kt`, `AndroidManifest.xml`; riesgo pendiente de verificación. | Enviar el formulario desde la acción del teclado cuando los datos sean válidos y probar el formulario con teclado abierto e insets en un dispositivo estable. |
| Las etiquetas «Inicio», «Resumen», «Stock», «Inventario», «Sugerencias» y «Recomendaciones» usan términos distintos para áreas relacionadas. MAE y WAPE no se explican en la pantalla de pronóstico. | `BusinessScreen.kt`, `ProductDetailScreen.kt`. | Usar nombres consistentes en navegación y detalle; explicar las métricas en lenguaje sencillo, conservando el nombre técnico si se necesita para la exposición. |
| El detalle presenta el pronóstico semanal y el historial como filas de texto, sin gráfica que permita comparar ambos periodos de un vistazo. La recomendación aparece debajo del pronóstico. | `ProductDetailScreen.kt`; inspección de pantalla. | Usar una visualización compacta con leyenda y unidad visible, separar visualmente histórico y pronóstico, y presentar primero la decisión de recomendación. No agregar datos que la API no entregue. |
| El catálogo y el resumen pueden mostrar cantidades de inventario sin identificar claramente si son datos actuales o referencias sintéticas. La tarjeta de recomendación no presenta la misma advertencia sintética que el pronóstico. | `BusinessScreen.kt`, `ProductDetailScreen.kt`. | Mostrar el origen del dato junto a cada cantidad y mantener visible la marca de datos sintéticos en toda vista derivada de ellos. |

## Comprobaciones pendientes

No hay evidencia suficiente para declarar estos puntos como defectos, por lo que deben validarse en un emulador o dispositivo estable antes de cerrar el rediseño:

- áreas táctiles efectivas de al menos 48 dp;
- orden del foco, foco visible y anuncios de TalkBack;
- formulario con el teclado abierto y envío mediante «Listo»;
- pantallas de 320 dp de ancho, orientación horizontal y texto al 200 %;
- contraste de iconos, divisores y controles en el tema oscuro;
- fluidez durante desplazamiento en un dispositivo de recursos modestos.

## Cobertura por criterio solicitado

| Criterio | Estado observado |
|---|---|
| Jerarquía y acción en pocos segundos | La pestaña de recomendaciones enseña la decisión y su explicación, pero el resumen y el catálogo no la exponen directamente. Inspección de código, sin captura del flujo autenticado. |
| Consistencia visual y navegación | Hay etiquetas diferentes para secciones relacionadas; el resumen tiene una pestaña propia y un título interno distinto. La selección de negocio y el regreso existen en el flujo actual. |
| Carga, vacío, error, desconexión y 429 | Existen mensajes para carga, vacío, errores de conexión y 429 en el código. No se verificaron en pantalla durante esta revisión. |
| Formularios de registro e inventario | No se encontraron pantallas de registro ni edición de inventario. El login tiene validación local básica; el flujo de guardar inventario existe en el `ViewModel`, pero no hay formulario visible. |
| Pronóstico y gráficas | La pantalla muestra listas de histórico y pronóstico por semana; no hay gráfica trazada ni ejes. |
| Accesibilidad | Se detectaron riesgos semánticos y de contraste descritos arriba. Tamaños táctiles, orden del foco y escalado al 200 % quedan sin comprobar en ejecución. |
| Lenguaje | La interfaz está en español; los acrónimos MAE y WAPE no se explican y la expresión «semana(s)» es poco natural. |
| Transparencia de datos | Algunas vistas muestran el carácter sintético; otras cantidades del catálogo no explican su procedencia de forma consistente. |

## Cobertura de interfaz existente

El código actual contempla inicio de sesión, selección de negocio, resumen, catálogo, consulta de inventario, recomendaciones y detalle de producto. No se encontró interfaz de registro o perfil, edición de inventario ni una gráfica trazada; el detalle presenta historial y pronóstico como listas. No se deben presentar capturas de esas funciones como existentes. La verificación de la matriz de estados y del flujo completo queda pendiente de un emulador estable y credenciales demo.

La suite actual cubre `ViewModel` con pruebas JVM. El proyecto no tiene pruebas instrumentadas de interfaz, herramienta de capturas automatizadas ni composables `@Preview`. Añadir un arnés nuevo de pruebas visuales requeriría dependencias y configuración adicionales, así que queda fuera de esta auditoría.
