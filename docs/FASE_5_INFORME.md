# Fase 5 — Pronóstico de demanda

## Objetivo

Preparar series temporales sin usar información futura, comparar métodos con validación cronológica, medir el resultado en un tramo reservado y reutilizar el modelo entrenado.

## Variables y protocolo de evaluación

Cada ejemplo estima las unidades vendidas en una semana usando las cuatro semanas anteriores, su promedio, el tiempo transcurrido y la identidad de negocio y producto. La semana objetivo no forma parte de sus variables.

Las fechas del conjunto completo se ordenan y se comparten como cortes entre las series de una misma unidad: 60 % para entrenamiento, 20 % para validación y 20 % para prueba. Así, al combinar productos de una unidad, ninguna etiqueta posterior de una serie puede quedar en entrenamiento mientras otra serie ya está en validación o prueba. Los ejemplos que requieren cuatro semanas anteriores no pueden empezar en las primeras cuatro semanas; en una serie sincronizada de 50 semanas, quedan 26 ejemplos de entrenamiento, 10 de validación y 10 de prueba.

La validación escoge el método por unidad usando MAE. Random Forest solo se selecciona si supera por MAE a las dos líneas base; de lo contrario se usa la mejor línea base. La prueba permanece reservada para informar el resultado final y no cambia esa decisión. La evaluación de prueba es de un paso rodante: para cada fecha se usan las cuatro ventas reales previas, como estarían disponibles al emitir el siguiente pronóstico.

Los candidatos son:

- **Última semana:** repite la demanda observada más reciente.
- **Promedio móvil de cuatro semanas:** usa la media de las cuatro demandas anteriores.
- **Random Forest:** aprende patrones compartidos entre series de la misma unidad con `RandomForestRegression` de [`ml-random-forest`](https://github.com/mljs/random-forest).

MAE conserva la unidad de medida. WAPE se expresa como porcentaje y solo se calcula cuando la suma de ventas reales del grupo es mayor que cero. Las métricas se agregan por unidad y por combinación de negocio y unidad; no se mezclan kilogramos, piezas u otras unidades. El conjunto de prueba no se usa para elegir el método.

## Ejecución y resultado de prueba

La evaluación local se ejecutó con `SalesCsvRepository` y `ForecastService.initialize()`, sobre los CSV sintéticos del proyecto. No se conectó a MySQL. El conjunto contiene 50 series y 2,300 ejemplos evaluables después de reservar las cuatro semanas iniciales de cada serie.

| Unidad | Entrenamiento | Validación | Prueba | MAE validación RF / última semana / promedio 4 semanas | Método elegido en validación | MAE de prueba del método elegido | WAPE de prueba |
|---|---:|---:|---:|---:|---|---:|---:|
| kg | 260 | 100 | 100 | 2.6251 / 3.2100 / 2.4650 | Promedio de 4 semanas | 2.8550 | 13.5629 % |
| paquete | 156 | 60 | 60 | 7.2498 / 9.1000 / 7.3458 | Random Forest | 6.8046 | 13.1702 % |
| pieza | 572 | 220 | 220 | 6.2029 / 6.4000 / 6.2080 | Random Forest | 7.5238 | 25.4809 % |
| bolsa | 78 | 30 | 30 | 3.2286 / 4.7667 / 3.2750 | Random Forest | 2.6743 | 10.0287 % |
| botella | 78 | 30 | 30 | 2.8550 / 3.4000 / 2.8917 | Random Forest | 3.4562 | 19.6375 % |
| lata | 52 | 20 | 20 | 2.3246 / 4.1500 / 2.8375 | Random Forest | 2.5130 | 13.1569 % |
| envase | 52 | 20 | 20 | 2.2054 / 3.0000 / 2.4125 | Random Forest | 3.3042 | 13.6538 % |
| caja | 26 | 10 | 10 | 14.9056 / 6.9000 / 7.5750 | Última semana | 5.8000 | 25.2174 % |
| juego | 26 | 10 | 10 | 14.3329 / 5.2000 / 6.4000 | Última semana | 3.9000 | 20.3125 % |
| **Total** | **1,300** | **500** | **500** | — | — | — | — |

La columna de selección refleja exclusivamente la validación. Por ello puede ocurrir que otra opción tenga menor MAE en la prueba reservada: por ejemplo, Random Forest fue seleccionado para `pieza`, `botella`, `lata` y `envase`, pero su MAE observado en la prueba fue mayor que alguna línea base. Se conserva la selección original para no usar el tramo final como una segunda oportunidad de ajuste.

### Resultado por negocio y unidad

Esta segunda tabla informa las métricas de la prueba para cada negocio y unidad. Un negocio que vende varias unidades aparece en varias filas para no combinar magnitudes incompatibles.

| Negocio | Unidad | Observaciones de prueba | Método seleccionado en validación | MAE de prueba | WAPE de prueba |
|---|---|---:|---|---:|---:|
| Frutería La Huerta | kg | 100 | Promedio de 4 semanas | 2.8550 | 13.5629 % |
| Panadería La Espiga | paquete | 60 | Random Forest | 6.8046 | 13.1702 % |
| Panadería La Espiga | pieza | 40 | Random Forest | 8.4056 | 10.4677 % |
| Electrónica Punto Digital | pieza | 100 | Random Forest | 2.4583 | 20.5886 % |
| Abarrotes El Puente | bolsa | 30 | Random Forest | 2.6743 | 10.0287 % |
| Abarrotes El Puente | botella | 30 | Random Forest | 3.4562 | 19.6375 % |
| Abarrotes El Puente | lata | 20 | Random Forest | 2.5130 | 13.1569 % |
| Abarrotes El Puente | envase | 20 | Random Forest | 3.3042 | 13.6538 % |
| Papel y Tinta | pieza | 80 | Random Forest | 13.4148 | 51.3486 % |
| Papel y Tinta | caja | 10 | Última semana | 5.8000 | 25.2174 % |
| Papel y Tinta | juego | 10 | Última semana | 3.9000 | 20.3125 % |

Las cifras corresponden a una ejecución local del conjunto incluido en el proyecto; no representan ventas reales. Las métricas por negocio se calculan entre productos del mismo negocio y unidad.

## Artefacto y solicitudes

La huella SHA-256 del conjunto permite reutilizar el artefacto cuando la entrada no cambia. Cuando se inicializa el servicio, una huella nueva provoca evaluación, selección y entrenamiento de despliegue con el histórico completo. La selección se mantiene asociada a cada unidad. Las solicitudes HTTP consultan el modelo cargado y no entrenan otro.

El artefacto conserva versión, huella, variables, codificaciones, métricas y modelos serializados. El cambio al protocolo de tres tramos sube la versión del artefacto para evitar cargar un resultado generado con el esquema anterior.

## Alcance y limitaciones

- Los datos evaluados son sintéticos; estas métricas no demuestran precisión comercial con ventas reales.
- Cada serie tiene 10 observaciones semanales en el tramo final. Aunque una unidad agregue varias series, esos errores pueden estar correlacionados y no equivalen a la misma cantidad de observaciones independientes.
- Diez semanas no cubren un ciclo anual semanal de 52 semanas. El MAE y WAPE describen el tramo observado y pueden cambiar en otras temporadas o ante cambios de demanda.
- El umbral operativo de 30 observaciones usado para etiquetar muestras pequeñas no es una regla estadística universal. Los conteos por serie y grupo se exponen para interpretar cada métrica.
- La prueba estima el error de un pronóstico de un paso que se actualiza al observar la semana anterior; no estima un pronóstico emitido una sola vez para diez semanas futuras.

La evaluación temporal responde a la pregunta de predecir períodos posteriores y evita mezclar semanas futuras en el entrenamiento. No es el único método válido para todos los problemas de series temporales; la elección depende del uso esperado y de las propiedades de los datos. La evaluación rodante también genera errores relacionados entre sí, no nuevos historiales independientes. La investigación y sus fuentes están en [FASE_9_RESEARCH.md](FASE_9_RESEARCH.md).
