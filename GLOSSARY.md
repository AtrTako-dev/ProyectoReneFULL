# Glosario de More Stock

Este glosario define el lenguaje compartido para los datos de inventario, ventas y acceso de More Stock.

## Lenguaje

**Negocio**:
Comercio independiente con su propio surtido, usuarios autorizados, ventas e inventario actual.
_Evitar_: usuario, tienda de la matriz

**Catálogo global**:
Lista compartida de identidades y atributos descriptivos de productos. No indica que cada negocio venda todos los productos ni que compartan precios o ventas.
_Evitar_: catálogo de cada tienda

**Surtido**:
Relación entre un negocio y los productos que ofrece.
_Evitar_: inventario global

**Venta semanal agregada**:
Cantidad total de un producto vendida por un negocio durante una semana. No representa tickets ni movimientos individuales.
_Evitar_: transacción semanal

**Matriz de referencia**:
Historial sintético independiente identificado en el dataset con `negocio_id=900` y `usuario_id=0`. El cero es el marcador administrativo de ese escenario; no es un negocio operativo ni una cuenta autenticable.
_Evitar_: cuenta cero, tienda cero

**Inventario actual**:
Existencia contada para un producto del surtido de un negocio. Se mantiene separada del inventario histórico simulado.
_Evitar_: inventario final histórico

**Cuenta de aplicación**:
Identidad autenticable con credenciales y membresías explícitas a negocios. Los permisos no se deducen de identificadores del dataset.
_Evitar_: usuario del dataset

**Cuenta de demostración**:
Credencial de prueba habilitada únicamente en desarrollo/demo; la contraseña se almacena como hash.
_Evitar_: cuenta de producción predeterminada
