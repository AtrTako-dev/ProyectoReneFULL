# ADR 0001: Fuente de datos y alcance por negocio

- **Estado:** Aceptada
- **Fecha:** 2026-11-20

## Contexto

En una versión anterior, el generador producía CSV y JSON equivalentes para cada historial y un CSV consolidado que repetía las filas de los seis CSV atómicos. También calculaba parte de las ventas de las tiendas a partir de ventas contemporáneas de la matriz y exportaba un rezago de matriz como columna. La aplicación aún no contiene lector de datos ni módulo de Machine Learning.

## Decisión

1. Los seis CSV atómicos de ventas son la única fuente canónica para importar y entrenar; el futuro lector los procesa por flujo. Se conserva `resumen.json` únicamente como metadato. Se dejan de generar los JSON de ventas y el CSV consolidado redundante.
2. El catálogo global aporta identidad, categoría, marca y unidad. Un surtido explícito asocia cada producto con cada negocio. Los precios, ventas e inventarios operativos pertenecen a cada negocio. Los precios y demandas base usados internamente para simular las ventas no se exportan como atributos ni como variables de Machine Learning.
3. Las ventas de cada negocio se calculan a partir de su historial y de parámetros sintéticos propios. No consumen ventas de la matriz ni exportan una variable de rezago de la matriz.
4. La matriz (`negocio_id=900`, `usuario_id=0`) es un escenario sintético independiente. El cero funciona como marcador administrativo de ese escenario, no como cuenta autenticable ni como ID de una cuenta de la aplicación. La aplicación tendrá usuarios persistidos con IDs propios y roles mediante membresías; una cuenta de administrador también será una identidad real.
5. El inventario actual capturado por cada usuario es distinto de los inventarios históricos sintéticos del dataset.
6. Las cuentas de demostración usarán los correos `tienda1@ms.com` a `tienda5@ms.com` y solo se habilitarán en entorno local/demo. Las contraseñas se suministrarán fuera del repositorio, se guardarán como hashes y nunca se incorporarán a CSV ni al código fuente.

## Consecuencias

- El importador evita cargar dos representaciones de las mismas filas y puede leer CSV por flujo.
- Los parámetros ocultos del simulador no se convierten en features que revelen la receta usada para generar las ventas.
- Cambiar la matriz ya no modifica las series de las tiendas.
- La tabla global `products` se relaciona con cada negocio por `business_products`; una venta debe pertenecer a esa relación.
- Los IDs sintéticos del archivo no asignan permisos ni se reutilizan como IDs de usuarios autenticados.
- La matriz no se mezcla con datos reales de tiendas para entrenar o generar recomendaciones operativas.
- Las credenciales de demo requieren una bandera/configuración explícita de entorno; producción no recibe contraseñas predeterminadas.
