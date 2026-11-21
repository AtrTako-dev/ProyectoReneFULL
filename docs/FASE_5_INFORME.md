# Fase 5 — Pronóstico de demanda

## Objetivo

Preparar series temporales sin usar datos futuros, comparar modelos con una evaluación cronológica y guardar el modelo entrenado para reutilizarlo en las solicitudes de pronóstico.

## Preparación y evaluación

Cada ejemplo predice las unidades vendidas en una semana usando únicamente la demanda de las cuatro semanas anteriores, su promedio, el tiempo transcurrido y la identidad de negocio y producto. Las filas se separan cronológicamente por serie: 80 % para entrenamiento y 20 % para validación. La evaluación recorre cada semana del bloque final con las semanas anteriores ya observadas. Las métricas se calculan por unidad para no sumar, por ejemplo, kilogramos con piezas.

Se comparan tres métodos:

- Última semana: repite la demanda observada más reciente.
- Promedio móvil: usa la media de las cuatro semanas anteriores.
- Random Forest: aprende patrones compartidos entre series de la misma unidad.

El candidato usa `RandomForestRegression` de [`ml-random-forest`](https://github.com/mljs/random-forest), cuya API proporciona entrenamiento, predicción y serialización del modelo.

El Random Forest se elige para una unidad únicamente si su MAE de validación es menor que el de ambas líneas base. En las demás unidades, el pronóstico usa la línea base con menor MAE. Para varios pasos, el modelo actualiza los rezagos con predicciones anteriores.

## Resultados sobre el conjunto de demostración

La evaluación incluyó **500 observaciones de validación**, correspondientes a las últimas 10 semanas de las 50 series. El MAE representa el promedio del error absoluto en la unidad indicada.

| Unidad | MAE Random Forest | MAE última semana | MAE promedio de 4 semanas | Método seleccionado |
|---|---:|---:|---:|---|
| kg | 2.8444 | 3.3200 | 2.8550 | Random Forest |
| paquete | 6.9108 | 9.4500 | 7.1542 | Random Forest |
| pieza | 7.4059 | 5.9318 | 6.3545 | Última semana |
| bolsa | 2.7795 | 3.8333 | 2.7917 | Random Forest |
| botella | 3.6010 | 3.2667 | 3.1083 | Promedio de 4 semanas |
| lata | 2.5281 | 2.9500 | 2.1750 | Promedio de 4 semanas |
| envase | 3.1965 | 3.1500 | 2.5125 | Promedio de 4 semanas |
| caja | 14.1014 | 5.8000 | 8.3250 | Última semana |
| juego | 11.7602 | 3.9000 | 7.3750 | Última semana |

Los resultados muestran que el Random Forest no es el mejor método para todas las unidades; por eso la selección conserva las líneas base cuando tienen menor error.

## Persistencia y API

El artefacto guarda la configuración, los nombres de variables, las codificaciones, la huella de los datos, las métricas y el JSON de los modelos seleccionados en `forecast_model_artifacts`. Al iniciar, el backend reutiliza un artefacto solo cuando coincide la huella del conjunto; de lo contrario, vuelve a entrenar y sustituye la versión almacenada.

El endpoint de pronóstico expone el método seleccionado, sus métricas, el origen de los datos y el pronóstico por semana. El endpoint de evaluación informa métricas por unidad y por producto. Ambos permanecen bajo la autenticación y el acceso por membresía definidos en la fase 3.

## Alcance y limitaciones

La evaluación usa ventas sintéticas del proyecto. Sus métricas sirven para comparar modelos en la exposición escolar; no prueban precisión comercial con ventas reales. Las pruebas automatizadas de esta fase quedan pendientes para la etapa de pruebas del proyecto.
