# PulsoStock v3 — matriz de referencia no oficial y cinco negocios

**Uso exclusivamente académico.** Todos los registros de ventas, precios por producto, costos e inventarios son sintéticos. La matriz usa Soriana como referencia de escenario, pero no contiene transacciones oficiales de Soriana, PROFECO ni INEGI. Los indicadores públicos se conservan por separado en indicadores_reales_2026.csv.

## Archivos y granularidad

- matriz_soriana_simulada_20000.csv: 20,000 agregados semanales, 100 productos por 200 semanas, del 16 de enero de 2023 al 15 de noviembre de 2026. Es una referencia sintética con negocio_id=900 y usuario_id=0; no es una cuenta autenticable.
- Cada uno de los cinco archivos tienda_*_500.csv contiene 500 agregados semanales, 10 productos por 50 semanas, del 1 de diciembre de 2025 al 15 de noviembre de 2026. Los negocio_id 201–205 y usuario_id 1–5 son identificadores sintéticos de ejemplo; no representan cuentas ni personas existentes.
- catalogo_100_productos.csv contiene el catálogo global de 100 productos y sus unidades.
- surtido_por_negocio.csv contiene los 50 pares negocio-producto de las tiendas. La matriz de referencia usa el catálogo completo y no es parte del surtido de una cuenta autenticable.
- usuarios_y_negocios.csv relaciona IDs sintéticos de usuario y negocio; no contiene credenciales ni acredita cuentas existentes.
- indicadores_reales_2026.csv contiene ocho indicadores públicos agregados con fuente, período, unidad y referencia. No son ventas por producto.
- resumen.json registra las cantidades y rutas de los archivos canónicos.

Cada semana se representa con una fila por producto y entidad. El catálogo es global y se comparte por producto_id. Las tiendas tienen surtidos explícitos y parámetros de demanda propios por producto; sus ventas semanales no se calculan a partir de la serie de ventas de la matriz. Comparten definiciones del catálogo y factores de calendario, no ventas observadas.

precio_base_simulado_mxn, demanda_base_simulada y demanda_base_semanal_simulada son parámetros internos del simulador. No se exportan en los CSV canónicos y no son columnas operativas ni features de ML.

La fuente canónica de ventas consta de la matriz CSV y los cinco CSV de tiendas. El generador no crea JSON de ventas ni un CSV consolidado: eran copias redundantes de los CSV canónicos. No se deben importar simultáneamente esas exportaciones antiguas junto con los CSV canónicos.

## Predicción y evaluación

El objetivo de predicción es unidades_vendidas de la semana siguiente. La matriz permite una separación temporal de semanas 1–160 para entrenamiento, 161–180 para validación y 181–200 para prueba. Las tiendas tienen solo 50 semanas; semanas 41–50 forman una prueba breve. No se deben mezclar semanas futuras en el ajuste.

ventas_semana_anterior es el rezago del mismo producto y negocio; está vacío en la primera semana de cada serie. No se genera una columna de rezago de ventas de matriz en las tiendas. Los precios y descuentos solo deben usarse para pronóstico si se conocen de antemano. No usar ingresos_mxn, utilidad_bruta_mxn ni inventario_final de la semana objetivo como variables de entrada: son valores derivados de esa semana y provocarían fuga de información.

El modelo puede aprender patrones de este simulador, pero una buena precisión no demuestra capacidad de pronosticar ventas reales. Para una evaluación real se requieren transacciones observadas con permiso y una evaluación nueva sobre datos separados por tiempo.

## Calibración y fuentes públicas

No se incorporaron precios individuales de PROFECO a los registros sintéticos. Todos los precios de SKU son aproximaciones simuladas. El indicador de Soriana de ventas mismas tiendas de -3.6% en 3T26 inspiró una reducción sintética del 3% en la demanda de la matriz durante julio–septiembre de 2026; no se aplicó como tasa real por artículo ni afecta las ventas de las tiendas. Las banderas de eventos son factores de escenario sintéticos. Las semanas tienen límites lunes-domingo; la última semana de datos termina el 15 de noviembre de 2026.

Los valores y referencias incluidos están en indicadores_reales_2026.csv:

- Informe de Soriana 3T2026, publicado el 30 de octubre de 2026: https://www.organizacionsoriana.com/pdf/reportes/2026/3T_2026_Espanol_InfDirVfinal.pdf
- Datos abiertos y catálogo 2026 de PROFECO: https://datos.profeco.gob.mx/
- Historial de precios de PROFECO: https://qqp.profeco.gob.mx/historico
- INEGI EMEC, agosto de 2026: https://en.www.inegi.org.mx/contenidos/saladeprensa/boletines/2026/emec/emec2026_10.pdf
- Crecimiento de ventas de ANTAD, octubre de 2026: https://antad.net/indicadores/crecimiento-nominal-en-ventas/
- Preguntas frecuentes de El Buen Fin 2026: https://www.elbuenfin.org/preguntas-frecuentes

## Campos y unidades

Las ventas son cantidades semanales en la unidad declarada en el catálogo, que varía entre kg, pieza, paquete y otras unidades. Los montos son pesos mexicanos con redondeo a centavos. precio_lista_mxn, descuento_pct y precio_unitario_mxn describen precios; unidades_vendidas es la cantidad objetivo; ingresos_mxn equivale a precio_unitario_mxn por unidades_vendidas; y utilidad_bruta_mxn se calcula con el precio unitario menos costo_unitario_mxn, por las unidades vendidas.

El inventario es simulado y agregado semanalmente: inventario_final equivale a inventario_inicial más reabastecimiento_unidades, menos unidades_vendidas y merma_unidades. No hay eventos de inventario individuales ni identificadores de almacén.

## Importación y reproducibilidad

El importador operativo debe excluir siempre la matriz y cargar solo las cinco tiendas, el catálogo global y el surtido por negocio. El usuario_id=0 y los IDs 1–5 son identificadores sintéticos, no cuentas; no se deben convertir en usuarios de acceso. Si la matriz se necesita para análisis de referencia, cargarla aparte de las tablas operativas y autenticables. Leer los CSV por flujo de filas, no cargarlos completos en memoria.

El generador es un módulo ESM compatible con el type:module de Backend y no requiere dependencias externas. Utiliza una semilla fija para la matriz y semillas independientes por negocio. Desde la raíz del repositorio se ejecuta con node Backend/pulsostock_matriz_soriana_22500_v3/generar_dataset.js; escribe los archivos en su propia carpeta. La prueba se ejecuta con node --test Backend/test/generar_dataset.test.js.
