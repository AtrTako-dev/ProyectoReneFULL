# Sistema de diseño de More Stock

## Contexto y objetivo

More Stock ayuda a dueños y empleados de tiendas pequeñas a revisar inventario y decidir qué producto atender. La interfaz debe mostrar cantidades y decisiones con rapidez, mantener visibles las unidades y explicar cuándo la información es de demostración.

## Fundamentos y tokens

| Token | Tema claro | Tema oscuro | Uso |
|---|---|---|---|
| Primario | `#0C6B54` | `#8DD6BF` | Acciones principales y énfasis de marca. |
| Fondo | `#F5F7F4` | `#101512` | Fondo general de pantalla y barras del sistema. |
| Superficie | `#FFFFFF` | `#171D19` | Tarjetas y campos. |
| Texto principal | `#17221C` | `#E7EFEA` | Texto sobre fondo y superficie. |
| Texto secundario | `#48645C` | `#B2CCC2` | Información auxiliar y etiquetas. |
| Error | `#BA1A1A` | `#FFB4AB` | Errores y acciones para corregirlos. |

Los colores se declaran en `MoreStockTheme.kt`; los componentes consumen roles de `MaterialTheme.colorScheme` y no repiten valores hexadecimales.

### Estados de recomendación

Los estados siempre combinan color, icono y etiqueta para que la decisión no dependa únicamente de la percepción del color.

| Estado | Fondo claro / texto | Fondo oscuro / texto | Contraste de texto |
|---|---|---|---:|
| COMPRAR | `#D2F1E7` / `#063B30` | `#164E3A` / `#B7F7D5` | 10.43:1 / 7.91:1 |
| MANTENER | `#FFF1C2` / `#684500` | `#57410B` / `#FFE49A` | 7.63:1 / 7.76:1 |
| NO_COMPRAR | `#FCE8E6` / `#8D1D1D` | `#5A2525` / `#FFC5C1` | 7.66:1 / 8.12:1 |

Los iconos son trazos Compose propios; sus colores mantienen al menos 3:1 frente al fondo del badge. Los pares de texto de los estados superan 4.5:1.

### Tipografía, formas y espacio

- Fuente: sans serif del sistema Android; no se descarga ni se agrega una fuente al proyecto.
- Escala: etiquetas 11–14 sp, texto de apoyo 12–14 sp, texto principal 16 sp, títulos 20–24 sp y encabezados 28–32 sp. La configuración conserva `sp` para respetar el tamaño de texto del dispositivo.
- Espaciado: 4, 8, 12, 16, 24 y 32 dp, centralizados en `MoreStockSpacing`.
- Formas: esquinas de 4, 10, 14, 20 y 28 dp, definidas en `MaterialTheme.shapes`.
- Elevación: superficies planas o con elevación Material 3 discreta; el color y el espacio separan el contenido antes que las sombras.

## Componentes

Los composables de `FrontEnd/app/src/main/java/com/morestock/app/ui/view/components/` son de presentación: reciben contenido, estado y callbacks. No consultan HTTP, `ViewModel`, pronósticos ni reglas de negocio.

| Componente | Responsabilidad y estados |
|---|---|
| `ProductCard` | Presenta nombre, categoría, inventario con unidad, estado de recomendación opcional y aviso sintético opcional. La acción es un callback. |
| `RecommendationBadge` | Muestra la etiqueta recibida junto al icono y los colores semánticos de COMPRAR, MANTENER o NO_COMPRAR. Los estados desconocidos usan una apariencia neutral. |
| `MetricCard` | Presenta una cifra, su etiqueta y un detalle auxiliar opcional. |
| `ValidatedTextField` | Campo Material 3 con error en línea, tipo de teclado, acción IME y transformación visual configurables. |
| `PrimaryActionButton` | Acción principal con habilitación y carga; conserva el texto y comunica accesiblemente el estado de carga. |
| `SecondaryActionButton` | Acción secundaria con estado habilitado o deshabilitado. |
| `LoadingState` | Indicador y mensaje de carga anunciado como región viva. |
| `EmptyState` | Mensaje claro cuando no hay contenido. |
| `ErrorState` | Mensaje de error y acción opcional para reintentar, con anuncio accesible. |
| `SyntheticDataBanner` | Aviso visible de datos sintéticos, mostrado solo cuando el estado recibido lo indique. |
| `BusinessHeader` | Nombre y rol del negocio con acciones opcionales para regresar y actualizar. |

Las pantallas actuales usan los estados compartidos de carga, vacío y error. Los demás componentes proporcionan una base común para las vistas de acceso, negocio, inventario y pronóstico.

## Accesibilidad y comportamiento

- El texto normal mantiene contraste mínimo de 4.5:1; los iconos significativos mantienen 3:1 frente al fondo adyacente.
- Las decisiones incluyen icono y etiqueta legible; no se comunican solo mediante color.
- Las acciones usan controles Material 3 con objetivos táctiles de al menos 48 dp.
- Los mensajes de carga y error exponen semántica de estado para lectores de pantalla.
- Los campos muestran el error asociado y conservan el teclado configurado por la pantalla.
- Los títulos largos se recortan con puntos suspensivos en el encabezado; las tarjetas permiten varias líneas.
- El tema sigue el ajuste claro u oscuro del sistema. Los iconos de las barras del sistema cambian para conservar contraste.
- No se agregan dependencias, fuentes externas, iconos de terceros ni color dinámico.

## Tono de texto

Se usa español directo y cotidiano, con cantidades y unidades visibles. El texto explicativo de recomendaciones sigue viniendo de la API. Los avisos de estado y de datos sintéticos describen la interfaz, no sustituyen ni reinterpretan ese contenido.

## Antipatrones

- No usar hexadecimales, tamaños de texto ni espaciados arbitrarios dentro de cada pantalla.
- No presentar COMPRAR, MANTENER o NO_COMPRAR solo con color, emoji o un símbolo sin etiqueta.
- No ocultar errores ni reemplazar mensajes útiles por un spinner sin texto.
- No colocar cálculos de inventario, pronóstico o recomendación dentro de un composable.
- No presentar datos sintéticos como ventas reales.

## Verificación de U3

- Se agregaron dos previsualizaciones Compose agrupadas con todos los componentes, una clara y otra oscura. Compilaron; no se pudieron inspeccionar visualmente desde el IDE ni el emulador durante esta revisión.
- `testDebugUnitTest`: 18 pruebas, 0 fallos. Incluye contraste AA de texto y contraste no textual de iconos de recomendación.
- `lintDebug`: 0 errores y 8 avisos sobre versiones de herramientas, configuración de respaldo y recursos existentes.
- `assembleDebug`: terminó correctamente; el artefacto generado es de depuración.
- No se añadieron dependencias ni se modificó `Backend/`; MVVM y la lógica de `ViewModel` se mantienen.
