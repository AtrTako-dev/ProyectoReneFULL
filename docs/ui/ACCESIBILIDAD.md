# Revisión de accesibilidad de More Stock

## Resultado

La revisión por código y pruebas confirma el contraste de los colores semánticos, la etiqueta textual de las recomendaciones, los avisos accesibles de carga, error y validación, y una alternativa de texto para la gráfica. La revisión visual con TalkBack, texto al 200 %, pantalla compacta y orientación horizontal no pudo completarse porque el emulador Android API 36 no terminó de iniciar.

## Lista de comprobación

| Criterio | Resultado | Evidencia o límite |
| --- | --- | --- |
| Contraste de texto en tema claro y oscuro | Verificado por prueba | `MoreStockThemeTest` comprueba los pares de texto del tema y exige al menos 4.5:1. |
| Estados COMPRAR, MANTENER y NO_COMPRAR | Verificado por prueba y código | Cada estado combina etiqueta e icono; las pruebas exigen 4.5:1 para texto y 3:1 para iconos en ambos temas. |
| Trazos de la gráfica | Verificado por prueba | Los trazos primario y terciario alcanzan al menos 3:1 frente a la superficie en ambos temas. |
| Dependencia exclusiva del color | Corregido en código | La recomendación conserva texto e icono además del color; la leyenda diferencia historial sólido y pronóstico discontinuo. |
| Descripción y navegación de la gráfica | Revisado en código | La gráfica tiene descripción semántica, valor seleccionado, acciones accesibles para punto anterior/siguiente y una lista textual de los puntos. TalkBack no se pudo comprobar en ejecución. |
| Carga, vacío, error y validación | Revisado en código | Los estados anuncian cambios; los errores locales del campo usan una región viva asertiva. El aviso 429 anuncia el texto estático y deja el contador fuera de la región viva para evitar anuncios cada segundo. |
| Etiqueta y unidad en inventario | Revisado en código | El campo tiene la etiqueta “Existencia” y muestra la unidad junto a la cantidad. El foco inicial y el anuncio por TalkBack no se verificaron en el emulador. |
| Objetivos táctiles de al menos 48 dp | Pendiente de medición | Se emplean botones, chips y navegación Material 3. La revisión estática no mide los límites táctiles renderizados. |
| Escala de texto al 200 % | Pendiente de ejecución | Formularios, listas, detalle y diálogo permiten desplazamiento; algunas etiquetas pueden abreviarse visualmente con elipsis. Falta confirmar que los nombres sigan siendo claros en pantalla. |
| Pantalla compacta de 360 × 640 dp | Pendiente de ejecución | Las pantallas principales usan listas desplazables y las filas de detalle reparten el ancho entre etiqueta y valor. No se pudo comprobar el resultado renderizado. |
| Orientación horizontal | Pendiente de ejecución | El contenido principal puede desplazarse verticalmente. No se verificó el cambio de orientación ni el tamaño de cada control. |
| Tema claro y oscuro renderizados | Parcial | El código ofrece ambos temas y las pruebas miden contraste de los colores; no se pudieron revisar capturas renderizadas en el emulador. |
| Orden de foco y lectura con TalkBack | Pendiente de ejecución | La secuencia del árbol Compose y las acciones semánticas se revisaron estáticamente; faltó recorrer la app con un lector de pantalla. |
| Movimiento reducido | Sin animaciones de navegación | La navegación no introduce transiciones animadas. |

## Verificación automatizada

En la última corrida de U9 se ejecutaron `testDebugUnitTest`, `lintDebug` y `assembleDebug`.

- Pruebas unitarias: **36 aprobadas, 0 fallidas**.
- Lint: **0 errores y 9 advertencias**.
- Ensamblado debug: **correcto**.

Las advertencias de lint corresponden a versiones de herramientas o dependencias disponibles, compatibilidad del nivel objetivo, nomenclatura de funciones Compose ya existente, reglas de respaldo y una carpeta de iconos que coincide con el nivel mínimo. No impidieron compilar la app.

## Límite de la revisión en emulador

Se intentó iniciar `ReactNative_API_36` con renderizado por software. `adb` detectó el dispositivo, pero Android no informó el arranque completo y la instalación del APK respondió `device is still booting`. Por ese motivo no se aprobaron visualmente TalkBack, las dimensiones táctiles, el tamaño de texto, la orientación ni el contraste renderizado.
