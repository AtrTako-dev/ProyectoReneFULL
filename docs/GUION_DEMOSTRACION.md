# Guion de demostración de More Stock

**Duración aproximada:** 10 minutos
**Contexto:** usar una instalación local con MySQL, backend y aplicación Android iniciados. La matriz de ventas incluida es sintética; hay que decirlo antes de mostrar las métricas.

## Recorrido

### 0:00–0:45 | Propósito y datos

Presentar More Stock como una aplicación escolar para consultar surtidos, inventario y recomendaciones de reabastecimiento por negocio. Aclarar que las ventas de demostración son sintéticas y que las métricas no prueban resultados con ventas reales.

### 0:45–1:40 | Usuarios y negocios independientes

Iniciar sesión con una cuenta de demostración preparada y mostrar los negocios asociados a esa cuenta. Explicar que cada cuenta tiene membresías explícitas y que el backend verifica el acceso al negocio antes de devolver sus datos.

### 1:40–2:25 | Catálogo global y surtido

Abrir un negocio y recorrer su catálogo. Explicar que el catálogo global identifica productos, pero cada negocio tiene un surtido propio; no se asume que todos vendan los mismos artículos.

### 2:25–3:15 | Inventario

Abrir la pestaña de inventario y mostrar cantidades y unidades del negocio seleccionado. Distinguir el saldo de inventario actual del historial semanal sintético. El detalle identifica el inventario de referencia cuando el backend lo marca como sintético.

### 3:15–4:10 | Pronóstico

Seleccionar un producto. Mostrar el método elegido, la demanda pronosticada y la indicación de origen sintético cuando corresponda. Explicar que las solicitudes consultan un modelo ya inicializado y no lo entrenan en cada petición.

### 4:10–5:05 | Recomendación

Abrir la sección de recomendaciones del negocio. Mostrar el estado `COMPRAR`, `MANTENER` o `NO_COMPRAR`, la cantidad sugerida, la explicación y, cuando aplique, la marca de pronóstico sintético. Entrar al detalle para revisar el inventario objetivo.

### 5:05–6:00 | Explicación

En el detalle del producto, leer la explicación que devuelve el backend. Relacionar la cantidad sugerida con la demanda pronosticada, el inventario actual y la política de seguridad configurada.

### 6:00–6:50 | Historial y puntos del pronóstico

En la app, mostrar las listas “Últimas semanas registradas” y “Pronóstico por semana”, que mantienen separados los valores históricos y futuros. Para enseñar la estructura de la gráfica que entrega la API, consultar con un cliente REST local autenticado `GET /api/v1/businesses/{businessId}/products/{productId}/forecast?semanas=4` y mostrar `pronostico.grafica.historico` y `pronostico.grafica.pronosticos_semanales`. Aclarar que la respuesta ofrece los puntos para graficar, pero la app actual no dibuja una gráfica; el pronóstico se marca como sintético cuando así lo informa el backend.

### 6:50–7:35 | Calendario comercial

En un cliente REST local ya autenticado, consultar el calendario del negocio. Explicar que Black Friday y Cyber Monday se calculan con reglas; Buen Fin usa fechas publicadas para años anunciados y aparece como no configurado cuando no hay una fecha oficial registrada. El calendario se muestra como contexto y no modifica el pronóstico.

### 7:35–8:55 | Evaluación con semanas no vistas

Mostrar la tabla de [`FASE_5_INFORME.md`](FASE_5_INFORME.md). Explicar que entrenamiento, validación y prueba son cronológicos; validación escoge el método y el bloque de prueba mide el resultado posterior. Random Forest gana en algunas unidades; otras conservan una línea base. La tabla reporta MAE y WAPE por unidad sin sumar magnitudes distintas.

### 8:55–10:00 | Arquitectura y cierre

Recorrer el flujo: Android Compose/MVVM → API Express → controladores y servicios → repositorios → MySQL. El servicio de pronóstico prepara y cachea el artefacto según la huella de los datos. Cerrar recordando que la evaluación es demostrativa, que quedan pendientes TiDB/Render y que el APK generado es debug.

## Respuestas a preguntas frecuentes

**¿Por qué Random Forest no gana en todas las unidades?**

Cada unidad se evalúa por separado. Solo se escoge Random Forest cuando su MAE de validación es menor que el de las dos líneas base. En las demás unidades se conserva el método que obtuvo mejor MAE de validación. El tramo final no cambia esa decisión.

**¿Por qué usar datos sintéticos?**

Permiten demostrar el flujo sin presentar información privada de un comercio como si fuera pública. Sirven para probar la aplicación, pero no prueban la precisión comercial; para eso se necesitarían ventas reales y una evaluación con autorización.

**¿Qué significa evaluación temporal?**

Los períodos se ordenan por fecha: el modelo aprende de semanas anteriores, se compara en un bloque posterior y se reporta el error en un bloque final reservado. Así la prueba se parece más a pronosticar semanas futuras.

**¿Qué es fuga de datos?**

Ocurre cuando una entrada o decisión usa información que todavía no estaría disponible al pronosticar. More Stock crea las variables con las cuatro ventas previas, separa los períodos en orden y no usa el bloque de prueba para seleccionar el método.

**¿Qué expresan MAE y WAPE?**

MAE es el error absoluto promedio en la unidad del producto. WAPE divide la suma de errores absolutos entre la suma de ventas reales y lo expresa como porcentaje; no se informa cuando las ventas reales suman cero.

**¿El calendario estacional cambia la predicción?**

No. Los eventos se presentan como metadatos de contexto; el servicio no los usa para alterar la demanda pronosticada.
