# More Stock — Informe de análisis y cierre de Fase 1

**Fecha:** 20 de noviembre de 2026  
**Alcance:** inspección del proyecto, auditoría del dataset, decisiones de arquitectura y plan incremental. Las ventas del conjunto son sintéticas; este informe no presenta resultados de pronóstico.

## Resumen ejecutivo

El proyecto contiene una base de backend en JavaScript y un dataset canónico en CSV. La carpeta `FrontEnd/` existe, pero está vacía; todavía no hay proyecto Android. Los datos representan ventas semanales agregadas, no transacciones de caja. El dataset tiene 22,500 filas: 20,000 de una matriz de referencia sintética y 2,500 de cinco negocios simulados.

La fuente de ventas quedó consolidada en seis CSV: el CSV de matriz, separado de los cinco CSV de tiendas. `resumen.json` es metadato, no una segunda fuente de ventas. El catálogo global y el surtido explícito por negocio evitan duplicar la identidad de productos y permiten que cada tienda tenga su propio surtido. Las series de las tiendas son independientes de las ventas de la matriz.

La limitación principal no es una inconsistencia de archivos: **no hay ventas observadas de negocios reales**. Por ello, cualquier entrenamiento o evaluación sobre estos archivos demostraría comportamiento sobre datos sintéticos, no precisión comercial real. Las tiendas también tienen solo 50 semanas, y el conjunto actual no contiene semanas con cero ventas.

Este informe conserva el diagnóstico del proyecto al cierre de la Fase 1. Las fases 3, 4, 5, 6 y 7 se implementaron posteriormente; sus alcances y resultados se registran en [FASE_3_INFORME.md](FASE_3_INFORME.md), [FASE_4_INFORME.md](FASE_4_INFORME.md), [FASE_5_INFORME.md](FASE_5_INFORME.md), [FASE_6_INFORME.md](FASE_6_INFORME.md) y [FASE_7_INFORME.md](FASE_7_INFORME.md). La fase 8 y sus pendientes se registran en [FASE_8_INFORME.md](FASE_8_INFORME.md). Las observaciones y riesgos de este informe corresponden al estado que se revisó durante la Fase 1.

## 1. Inspección y rutas confirmadas

| Elemento | Ruta y estado |
|---|---|
| Raíz | `/home/tako/Escritorio/MoreStock/` |
| Backend | `Backend/`, con Express, pruebas, esquema y dataset |
| Frontend | `FrontEnd/`, directorio vacío; no contiene proyecto Kotlin/Android |
| Dataset | `Backend/pulsostock_matriz_soriana_22500_v3/` |
| Documentación | `docs/adr/`, `docs/superpowers/plans/` y `GLOSSARY.md` |
| Git | Hay un directorio `.git/`, pero `git status` no reconoce la carpeta como repositorio. No se detectó historial disponible para revisar o usar como punto de retorno. |

Se conservaron las mayúsculas reales de `Backend/` y `FrontEnd/`. El nombre heredado solo permanece en la ruta del dataset; la aplicación y la API se identifican como More Stock.

### Archivos de datos canónicos

- `matriz_soriana_simulada_20000.csv`
- `tienda_1_fruteria_la_huerta_500.csv`
- `tienda_2_panaderia_la_espiga_500.csv`
- `tienda_3_electronica_punto_digital_500.csv`
- `tienda_4_abarrotes_el_puente_500.csv`
- `tienda_5_papel_y_tinta_500.csv`
- `catalogo_100_productos.csv`
- `surtido_por_negocio.csv`
- `usuarios_y_negocios.csv`
- `indicadores_reales_2026.csv`
- `resumen.json` — manifiesto y metadatos; no contiene el historial de ventas.

Ya no se generan los JSON equivalentes de ventas ni `consolidado_22500.csv`. La generación y las pruebas se ejecutan desde JavaScript; no se añadió Python.

## 2. Auditoría de datos

| Serie | Filas | Productos | Semanas | Intervalo de semanas |
|---|---:|---:|---:|---|
| Matriz de referencia sintética | 20,000 | 100 | 200 | 16 ene 2023–15 nov 2026 |
| Cada uno de los cinco negocios | 500 | 10 | 50 | 1 dic 2025–15 nov 2026 |
| Total de filas de ventas | 22,500 | — | — | Semanal, producto-entidad |

La última semana empieza el 9 de noviembre de 2026 y termina el 15 de noviembre de 2026. La matriz usa `negocio_id=900` y `usuario_id=0` como identificadores sintéticos del escenario; el 0 representa al administrador del escenario de matriz, como marcador de datos, no una cuenta ni una credencial de acceso. Las tiendas usan negocios 201–205 y usuarios 1–5. También son IDs sintéticos y no representan cuentas registradas.

El catálogo contiene 100 productos y 10 categorías. Declara 11 unidades distintas: barra, bolsa, botella, caja, envase, frasco, juego, kg, lata, paquete y pieza. El surtido tiene 50 asociaciones, 10 por tienda; cada SKU vendido por una tienda aparece en su surtido y en el catálogo global. Las cantidades de productos con unidades distintas no se deben sumar en un mismo total.

Las seis series de ventas tienen 35 columnas. Incluyen identificadores y fechas, producto y unidad, precio/descuento, unidades vendidas, valores derivados, inventario semanal simulado, rezago de ventas del mismo producto y negocio, banderas de calendario y procedencia. La comprobación del conjunto encontró:

- 22,500 filas y ninguna clave duplicada `(negocio_id, producto_id, fecha_inicio)`.
- 200 semanas para la matriz y 50 para cada tienda.
- Ninguna fila con cantidad negativa o no numérica.
- No hay semanas registradas con `unidades_vendidas=0` en el dataset actual.
- 150 celdas vacías en `ventas_semana_anterior`: una primera observación por cada serie SKU (100 de matriz y 50 de tiendas). Es un rezago no disponible por diseño, no un dato perdido.
- Ocho indicadores públicos agregados en `indicadores_reales_2026.csv`. No son ventas por producto ni precios por SKU.

Todos los precios por producto, costos, ventas e inventarios de los seis CSV son sintéticos. Las cifras públicas están separadas y su granularidad no permite asignarlas legítimamente a productos individuales. En el catálogo no aparecen pan de muerto ni rosca de Reyes; no deben mostrarse pronósticos entrenados para esos productos.

## 3. Problemas detectados y solución elegida

| Problema | Solución adoptada o recomendada | Estado |
|---|---|---|
| CSV, JSON de ventas y consolidado podían duplicar importaciones y uso de memoria. | Se dejó un único formato canónico de ventas: CSV. Se conserva `resumen.json` solo como metadato; el lector futuro debe procesar filas por flujo. | Resuelto en los artefactos actuales. |
| La matriz y las ventas de tiendas podían confundirse o acoplarse. | La matriz queda solo como escenario de referencia. Cada tienda genera su historial desde sus propios parámetros; el importador operativo excluye la matriz. | Resuelto y cubierto por pruebas de independencia. |
| El catálogo se repetía por negocio y no había una relación clara de surtido. | Catálogo global único más tabla puente `surtido_por_negocio.csv`; el SKU del negocio se valida contra ambas fuentes. | Resuelto en los CSV; el importador aún no existe. |
| `usuario_id=0` y los IDs 1–5 podían interpretarse como cuentas de la aplicación. | El 0 identifica al administrador del escenario sintético de matriz; los IDs 1–5 son participantes sintéticos de las tiendas. Ninguno se reutiliza como usuario autenticado ni define permisos. | Decisión documentada. |
| Datos sintéticos podían presentarse como ventas observadas. | La metodología, indicadores y nombres de archivos señalan la procedencia; los datos públicos permanecen aparte. | Resuelto en documentación; la futura interfaz debe repetir esta distinción. |
| Series de tiendas cortas y sin semanas registradas con cero unidades vendidas. | Mantenerlas para el ejercicio escolar, pero no afirmar generalización real. Para una versión más realista, añadir semanas con cero unidades mediante una nueva versión documentada del dataset. No inventar ventas reales para completar huecos. | Limitación pendiente de una decisión de diseño del dataset. |
| Las fechas y banderas comerciales sintéticas no representan un calendario configurable ni evidencia de que el evento haya causado cambios en ventas. | Mantener el evento calendario separado de la tendencia observada. En una fase posterior, configurar y versionar eventos por año; medir su efecto solo con historial suficiente y evaluación temporal. | Pendiente de diseño en Fases 5–6. |
| Existencias de los CSV eran fáciles de confundir con stock vigente. | El inventario histórico sintético se separa del saldo actual capturado por el negocio. El saldo actual se conserva en `current_inventory`. | Separación definida en el esquema de Fase 2; todavía no hay captura de inventario. |
| Las recomendaciones de compra necesitan más que la predicción. | Antes de sugerir cantidades se deben capturar stock de seguridad, plazo de reabastecimiento y pedidos pendientes; configurar unidad y mínimo de compra por surtido cuando aplique. Si faltan, devolver recomendación no disponible o una cantidad claramente condicionada, nunca un valor supuesto. | Pendiente de Fases 4 y 6. |
| El archivo de ventas contiene variables que pueden filtrar el objetivo. | Excluir ingresos, utilidad, inventario final y cualquier campo de la semana objetivo. Usar precios/descuentos futuros solo si ya se conocen al emitir el pronóstico. | Regla definida; falta el pipeline de ML. |
| El generador usa `Number.toFixed()` para precios descontados y el redondeo binario deja 75 precios un centavo por debajo del redondeo decimal al centavo. | Adoptar una política decimal explícita, volver a generar en una copia temporal y revisar los cambios antes de sustituir los CSV. | P3; no bloquea Fase 3, pero debe corregirse antes de evaluar precios o importarlos en Fase 4. |
| El indicador de INEGI tiene una etiqueta abreviada que puede confundirse con ingreso nominal. | Precisar que el indicador trata de ingresos reales por suministro de bienes y servicios, conservando el valor y la fuente ya verificados. | P3 documental; no afecta las ventas sintéticas. |
| El ejemplo `.env.example` no se carga automáticamente al arrancar Node. | Antes de usar secretos locales en Fase 3, cargar el archivo explícitamente con una opción de Node compatible con el mínimo de versión elegido o documentar la inyección de variables en el entorno. | P2 condicional: bloquea pruebas locales que dependan de `.env`; no bloquea despliegues que inyecten variables. |
| `business_memberships.role` acepta cualquier texto. | Definir los valores permitidos para administrador del negocio y empleado; validar la lista en el servicio de autorización y rechazar valores desconocidos. | P2 para implementar autorización en Fase 3; el esquema actual no concede acceso por sí solo. |
| El esquema no conserva precios, descuentos ni banderas comerciales de cada semana. | Antes de cerrar el importador, definir qué variables históricas hacen falta para evaluación y pronóstico y persistir solo las necesarias por negocio/producto/semana. | Riesgo de Fase 4–5; `sale_price` es un precio por surtido, no historial semanal. |
| `weekly_sales` guarda `data_origin`, pero la clave primaria no lo incluye; dos orígenes para el mismo negocio/producto/semana colisionarían y una escritura de reemplazo podría sobrescribir el dato anterior. | Mantener IDs separados para negocios sintéticos y operativos, y hacer que el importador rechace colisiones. Si el dominio requiere dos orígenes para una misma semana y negocio, revisar la clave antes de importar. | Riesgo condicional de Fase 4; no hay base conectada ni filas persistidas. No bloquea Fase 3. |
| El generador escribe directamente y en secuencia sobre los archivos canónicos. Una interrupción durante una regeneración con cambios podría dejar archivos de versiones distintas o incompletos. | Generar en un directorio temporal, validar todas las salidas y reemplazar el conjunto solo después de completar la validación. Con el generador actual y sin cambios, la salida es reproducible byte por byte. | Riesgo operativo al regenerar; no hay indicios de corrupción actual. No bloquea Fase 3. |
| La carpeta no es un repositorio Git utilizable. | Habilitar control de versiones antes de cambios amplios y revisar su estado antes de crear historial. | Pendiente del entorno; no se modificó `.git/`. |

Las cuentas demo solicitadas (`tienda1@ms.com`–`tienda5@ms.com`) no están implementadas: pertenecen a autenticación, no al dataset. Las contraseñas acordadas se suministrarán fuera del repositorio para el entorno local/demo; se almacenarán hashes, nunca las contraseñas en CSV o código, y no se habilitarán en producción.

## 4. Problema predictivo y estrategia de Machine Learning

**Objetivo:** pronosticar `unidades_vendidas` para el siguiente período semanal, por negocio y producto. La unidad del pronóstico debe ser la unidad declarada en el catálogo.

**Variables candidatas:** rezagos del mismo negocio y producto (1, 2 y 4 semanas), promedio móvil calculado solo con semanas anteriores, categoría, unidad, negocio y variables de calendario conocidas. Los descuentos y precios solo entran si el valor para la semana pronosticada ya está disponible. Las ocho cifras externas agregadas no se unirán a SKU individuales como si fueran observaciones equivalentes.

**Variables a excluir:** `ingresos_mxn`, `utilidad_bruta_mxn`, `inventario_final` y otras columnas derivadas de las ventas de la semana objetivo; parámetros internos del simulador; rezagos de la matriz en negocios; y cualquier dato posterior a la semana objetivo. Los flags de calendario representan escenarios sintéticos, no prueban que un evento aumente la demanda.

**Comparación propuesta:**

1. Línea base A: repetir las ventas de la última semana.
2. Línea base B: promedio móvil de las últimas cuatro semanas.
3. Candidato de ML: regresión Random Forest pequeña en JavaScript, agrupando solamente los cinco negocios operativos y usando negocio/SKU como variables categóricas codificadas. Se selecciona únicamente si supera las líneas base en evaluación temporal; en caso contrario, no se presenta como mejor modelo.
4. La matriz se evalúa por separado. Su uso para transferir aprendizaje a tiendas sería un experimento independiente y se acepta solo si mejora la evaluación temporal de cada negocio.

La biblioteca [`ml-random-forest`](https://github.com/mljs/random-forest) ofrece regresión en JavaScript y muestra una API de entrenamiento/predicción apropiada para un primer candidato. TensorFlow.js también permite entrenar y ejecutar modelos bajo Node.js, pero no hay evidencia de que una red neuronal aporte valor con solo 50 semanas por negocio; se reserva como alternativa, no como elección inicial ([guía de Node.js de TensorFlow.js](https://www.tensorflow.org/js/guide/nodejs)). La dependencia se decidirá e instalará en la Fase 5, después de revisar el benchmark y el entorno de despliegue.

**Evaluación:** usar separación cronológica, nunca aleatoria. Para la matriz, entrenar semanas 1–160, validar 161–180 y probar 181–200. Para tiendas, comparar predicciones de semanas posteriores mediante origen rodante; el bloque final de 10 semanas ofrece una prueba breve, no una evaluación de estacionalidad anual. Reportar MAE y WAPE cuando la suma real del período no sea cero, además de resultados por negocio y SKU. No mezclar métricas de kg con piezas o paquetes.

**Conclusión sobre suficiencia:** la matriz tiene cuatro años aproximados, pero sigue siendo sintética y no describe necesariamente el patrón de un comercio especializado. Cada tienda solo tiene 50 observaciones semanales por SKU; no cubre dos ciclos anuales. El conjunto actual no tiene semanas registradas con cero unidades vendidas, por lo que no prueba demanda intermitente. Cualquier puntuación obtenida medirá ajuste a esta simulación, no precisión futura en More Stock con datos reales.

## 5. Arquitectura propuesta

### Backend

Node.js y Express, JavaScript ESM y arquitectura Modelo-Controlador. El controlador valida la entrada HTTP y llama a servicios; los servicios contienen casos de uso y reglas; los repositorios encapsulan consultas parametrizadas MySQL/TiDB; los modelos y validadores representan el dominio. Ninguna ruta debe conectarse directamente a la base de datos ni contener lógica de ML o recomendación.

Módulos propuestos: configuración y middleware; usuarios/autenticación; negocios y membresías; catálogo/surtido; importación y ventas; inventario; pronósticos; calendario comercial configurable; motor de recomendaciones; explicaciones; y API versionada. El backend es la única capa que entrena/ejecuta ML y calcula decisiones comerciales.

### Android

Kotlin y Jetpack Compose con MVVM. Las pantallas emiten acciones; ViewModels administran estados y errores; repositorios consumen la API; modelos representan respuestas y dominio. Android no accede directamente a MySQL ni replica las reglas comerciales.

### API

API REST versionada bajo `/api/v1`. La ruta de salud existente comprueba disponibilidad del proceso solamente. Las rutas futuras autenticadas deben resolver permisos por membresía del usuario, no confiar en un `business_id` enviado por el cliente sin autorización.

## 6. Modelo relacional propuesto

El esquema de partida existente en `Backend/database/schema.sql` ya separa:

- `users`: identidad, correo único y hash de contraseña.
- `businesses`: comercios.
- `business_memberships`: relación muchos a muchos y rol por negocio.
- `products`: catálogo global con SKU, categoría, marca y unidad.
- `business_products`: surtido por negocio y datos comerciales propios.
- `weekly_sales`: serie semanal única por negocio/producto/semana, con cantidad decimal y procedencia.
- `current_inventory`: saldo actual separado de snapshots semanales históricos.

Los CSV de `usuario_id`/`negocio_id` no se insertan como identidades reales. La matriz se conserva fuera de tablas operativas. El importador deberá asociar IDs sintéticos con los negocios de demo mediante configuración explícita, aplicar validaciones y realizar upsert/transacción para que una reimportación no duplique semanas. El inicio de semana se valida como lunes en la capa de importación/escritura.

En las fases posteriores se agregarán, con alcance mínimo y justificado, pedidos pendientes o cantidades en tránsito; parámetros de reabastecimiento por negocio-producto; y snapshots de pronóstico/recomendación si se necesita historial visible. No se requiere tabla independiente por cada categoría o evento mientras el dominio no lo justifique.

## 7. Estructura de carpetas propuesta

Se conserva la estructura actual y se propone crecerla gradualmente; **no se han movido datasets**.

```text
MoreStock/
├── Backend/
│   ├── database/
│   │   └── migrations/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── routes/
│   │   ├── services/
│   │   │   ├── forecasting/
│   │   │   ├── inventory/
│   │   │   ├── recommendations/
│   │   │   └── explanations/
│   │   └── validators/
│   ├── data/
│   │   └── seed/                 # posible ubicación futura; mover solo tras acordarlo
│   ├── test/
│   └── pulsostock_matriz_soriana_22500_v3/  # ubicación actual conservada
├── FrontEnd/
│   └── app/src/main/java/com/morestock/app/
│       ├── data/
│       ├── domain/
│       └── ui/
│           ├── screens/
│           └── viewmodel/
└── docs/
    ├── adr/
    └── superpowers/plans/
```

`data/seed/` es solo una propuesta. El importador debe recibir únicamente los cinco CSV de tiendas, catálogo y surtido para datos operativos; la matriz no entra en ese flujo.

## 8. Plan de implementación incremental

Cada tarea tiene un alcance pequeño y una verificación definida. Los nombres de módulo indican destinos propuestos y no implican que esos módulos ya existan.

### Fase 1 — Análisis y planificación

| Tarea | Objetivo y archivos | Resultado esperado | Verificación | Dependencias / estado |
|---|---|---|---|---|
| F1.1 | Inspeccionar `Backend/`, `FrontEnd/`, `docs/` y el dataset | Inventario de rutas y estado real | Confirmar archivos y directorios directamente | Ninguna; completada. |
| F1.2 | Auditar CSV, catálogo, surtido e indicadores | Conteos, granularidad, unidades, fechas, relaciones y vacíos | Reconciliar total, claves y correspondencia de SKU | F1.1; completada. |
| F1.3 | Definir identidad y separación por negocio en ADR/glosario | IDs sintéticos separados de usuarios y roles reales | Revisar que el modelo nunca derive permisos del CSV | F1.2; completada. |
| F1.4 | Definir arquitectura, modelo relacional y plan en este informe | Decisiones y fases revisables | Comprobar que cada fase tenga tareas, entregable y verificación | F1.1–F1.3; completada. |

### Fase 2 — Fundamentos backend

| Tarea | Objetivo y archivos | Resultado esperado | Verificación | Dependencias / estado |
|---|---|---|---|---|
| F2.1 | Revisar `Backend/package.json`, `.env.example`, `.gitignore` y `src/config/env.js` | Configuración reproducible y secretos fuera del repositorio | Probar puertos válidos/inválidos y confirmar que `.env` se ignore | F1; los archivos ya existen. |
| F2.2 | Revisar `src/app.js`, `server.js`, rutas y controlador de salud | Servidor mínimo con ruta de salud, JSON 404 y errores controlados | Pruebas HTTP de salud, ruta inexistente y JSON mal formado | F2.1; los archivos ya existen. |
| F2.3 | Revisar `database/schema.sql` | Relaciones, llaves y unidades coherentes con el dominio | Inspección SQL; no ejecutar ni conectar una DB durante esta revisión | F1.3; el esquema ya existe. |
| F2.4 | Revisar todas las pruebas de Backend y el estado Git | Base validada y cambios trazables | `npm test`; revisar estado/diff del repositorio | F2.1–F2.3; verificación previa: 11/11; Git no está inicializado. |

### Fase 3 — Usuarios y negocios

| Tarea | Objetivo y archivos | Resultado esperado | Verificación | Dependencias |
|---|---|---|---|---|
| F3.1 | Modelos/repositorios de `users`, `businesses` y `business_memberships` | Persistencia de identidad y membresías | Pruebas de correo único, rol válido y relación muchos a muchos | F2 y conexión/configuración aprobadas. |
| F3.2 | Servicio/controladores/rutas de registro e inicio de sesión | Autenticación con hash seguro y respuesta de sesión | Pruebas de credenciales correctas/incorrectas y cierre | F3.1; secreto de sesión desde entorno. |
| F3.3 | Middleware de autenticación y autorización por negocio | Acceso filtrado por membresía y rol | Usuario de una tienda no puede leer ni cambiar otra | F3.2. |
| F3.4 | Inicializador local de cuentas demo `tienda1@ms.com`–`tienda5@ms.com` | Cinco cuentas demo separadas de identidades del dataset | Solo funciona con bandera demo local; lee las contraseñas desde configuración fuera del repositorio y almacena hashes | F3.1–F3.3; no se habilita en producción. |

### Fase 4 — Catálogo, ventas e inventario

| Tarea | Objetivo y archivos | Resultado esperado | Verificación | Dependencias |
|---|---|---|---|---|
| F4.1 | Servicio/importador CSV por flujo y validadores | Lectura acotada en memoria y errores de fila explícitos | Archivo grande de prueba, encabezados inválidos y tipos incorrectos | F3 y mapa explícito de negocios demo. |
| F4.2 | Importar catálogo y surtido a `products` y `business_products` | SKU global y surtido por tienda | Rechazar asociación a producto inexistente o repetida | F4.1. |
| F4.3 | Importar ventas a `weekly_sales` | Historial semanal idempotente | Ejecutar importación dos veces; comprobar mismas filas y llaves | F4.1–F4.2; solo cinco tiendas operativas, nunca matriz. |
| F4.4 | Capturar saldo actual y movimientos de inventario | Stock actual independiente de snapshots sintéticos | Ajustes con unidad correcta y consistencia de saldo | F4.2–F4.3; permisos de F3. |

### Fase 5 — Machine Learning

| Tarea | Objetivo y archivos | Resultado esperado | Verificación | Dependencias |
|---|---|---|---|---|
| F5.1 | Transformar `weekly_sales` en ejemplos temporales | Features calculadas solo con semanas pasadas | Revisar manualmente filas límite y ausencia de fuga | F4; marcar el conjunto como sintético. |
| F5.2 | Implementar líneas base última semana y promedio móvil | Referencia reproducible para cada SKU | Evaluación cronológica con MAE/WAPE válido | F5.1. |
| F5.3 | Entrenar/evaluar candidato Random Forest en JS | Modelo seleccionado solo si mejora a las bases | Holdout temporal y resultados por negocio, SKU y unidad | F5.2; revisar dependencia vigente antes de instalar. |
| F5.4 | Guardar modelo y metadatos y exponer pronóstico semanal | Predicción sin reentrenar por solicitud | Guardar/cargar produce predicciones iguales; endpoint valida permiso | F5.3. |

### Fase 6 — Recomendaciones y explicaciones

| Tarea | Objetivo y archivos | Resultado esperado | Verificación | Dependencias |
|---|---|---|---|---|
| F6.1 | Definir política de inventario y cantidades sugeridas | Estados COMPRAR/MANTENER/NO_COMPRAR con reglas visibles | Casos de faltante, exceso, pedido pendiente, unidad y producto perecedero | F4.4–F5.4; acordar plazo/seguridad/mínimos. |
| F6.2 | Calendario configurable y versionado por año | Evento calendario separado de tendencia observada | Probar fechas móviles y límites de año; no atribuir causalidad sin evidencia | F1.2; configurar eventos relevantes por categoría. |
| F6.3 | Servicio de explicación y endpoint de resultados | Explicación reproducible basada en pronóstico, inventario y evidencia | Verificar que cada frase se sustente en variables disponibles y autorizadas | F6.1–F6.2. |

### Fase 7 — Android con MVVM

| Tarea | Objetivo y archivos | Resultado esperado | Verificación | Dependencias |
|---|---|---|---|---|
| F7.1 | Crear módulo Android Kotlin/Compose y navegación inicial | Esqueleto Android con MVVM | Compilación y navegación básica | Contratos API estables y autenticación F3. |
| F7.2 | Modelos, cliente HTTP y repositorios | Consumo de API tipado y aislado de UI | Pruebas de respuestas, errores y timeout | F7.1. |
| F7.3 | ViewModels y pantallas de login, negocios y catálogo | Flujo de sesión y selección autorizada | Estados carga/éxito/error y permisos | F7.2–F3.3. |
| F7.4 | Pantallas de inventario, pronóstico y recomendación | Visualización por producto y unidad | Integración con datos backend y explicación textual | F7.3 y F6.3. |

### Fase 8 — Integración y entrega

| Tarea | Objetivo y archivos | Resultado esperado | Verificación | Dependencias |
|---|---|---|---|---|
| F8.1 | Ejecutar integración completa Backend–Android–DB | Flujos principales conectados | Pruebas de registro, aislamiento, importación, pronóstico y recomendación | F2–F7. |
| F8.2 | Revisar seguridad, errores, métricas y documentación académica | MVP explicable con límites y fuentes claras | Revisar credenciales, roles, datos sintéticos y resultados de evaluación | F8.1. |
| F8.3 | Preparar configuración de despliegue Render/TiDB | Despliegue reproducible y sin secretos en el código | Prueba controlada de configuración y endpoint, tras autorización de publicación | F8.2; no desplegar automáticamente. |

## 9. Riesgos y decisiones pendientes

1. **Datos de operación:** hacen falta ventas reales autorizadas para medir utilidad práctica. No se deben fabricar ni etiquetar como reales.
2. **Configuración local:** los scripts leen `process.env`, pero no cargan `.env`; las pruebas de Fase 3 deben inyectar variables o habilitar explícitamente el archivo local.
3. **Roles:** acordar valores canónicos para administrador del negocio y empleado y denegar todo valor desconocido al autorizar.
4. **Base de datos:** Fase 2 solo define el esquema. Para integrar y verificar Fase 3 se necesitarán una instancia MySQL/TiDB accesible y credenciales fuera del repositorio.
5. **Ceros y productos sin historia:** antes de modelar demanda intermitente, definir una nueva versión del dataset que represente semanas con cero unidades vendidas; no agregar productos estacionales sin historia y tratarlos como pronosticados.
6. **Calendario comercial:** configurar fechas de eventos por año y separarlas de cualquier efecto medido. Los flags del dataset actual son escenarios sintéticos.
7. **Política de compra:** acordar cómo obtener plazo de entrega, seguridad, pedidos en tránsito, cantidades mínimas y reglas para perecederos. Si esos datos faltan, la app debe explicar la limitación.
8. **Transferencia desde la matriz:** probarse aparte; si no mejora las líneas base con tiendas retenidas por tiempo, excluirla del modelo operativo.
9. **Cuentas demo:** crear solo en modo local/demo. Credenciales fijas débiles no deben habilitarse en despliegue público.
10. **Git:** el directorio actual no tiene un repositorio Git funcional. Conviene habilitar control de versiones antes de cambios amplios, pero requiere corregir primero el entorno del directorio `.git/`.
11. **Estado de fases:** la base de Fase 2 fue revisada; no se inició autenticación, importador, ML, recomendaciones, Android ni despliegue (Fases 3–8).

## 10. Recomendación de la primera tarea de programación

Al cierre de Fase 1, se recomendó revisar la base existente de Fase 2 antes de avanzar. Esa revisión ya se realizó: la API, el esquema y el modelo de dominio pasaron la revisión técnica, las pruebas y el arranque local. El repositorio Git sigue sin inicializar; el siguiente avance funcional sería Fase 3, sujeto a aprobación.

## Verificación registrada

En la revisión actual, `npm test` terminó con **12/12 pruebas aprobadas**. Una regeneración en copia temporal coincidió byte por byte con los 13 archivos actuales del dataset. Además, la revisión aritmética detectó 75 precios descontados con una diferencia de un centavo respecto al redondeo decimal al centavo. No se modificaron los CSV ni se ejecutó SQL.
