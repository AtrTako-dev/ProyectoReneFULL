# Fase 3 — Usuarios y negocios

## Objetivo

Permitir que las personas creen una cuenta, administren sus negocios y accedan únicamente a los negocios donde tienen una membresía con un rol válido.

## Implementación

- El correo se normaliza y su unicidad se protege en MySQL.
- Las contraseñas se almacenan como hashes `scrypt` con salt individual.
- El registro crea en una transacción la cuenta, el negocio propio, la membresía de administrador y la sesión inicial.
- Las sesiones usan tokens aleatorios; la base guarda su hash y fecha de expiración. El cierre elimina la sesión.
- `business_memberships` relaciona usuarios y negocios y admite los roles `business_admin` y `employee`.
- El middleware exige una sesión y una membresía para acceder a las rutas de un negocio. Las operaciones administrativas requieren `business_admin`.
- Las cinco cuentas y los datos sintéticos solo se cargan con `NODE_ENV=development` y `DEMO_MODE=true`. El ejemplo de entorno deja el modo demo apagado; las credenciales locales permanecen fuera del código y del control de versiones.
- En desarrollo, el servidor escucha únicamente en `127.0.0.1`, por lo que las cuentas demo no quedan expuestas a otros equipos de la red local.

## Verificación

La suite del backend terminó con **11 pruebas aprobadas y 0 fallidas** contra el MySQL local. Incluye registro, correo duplicado, contraseña incorrecta, relaciones de un usuario con varios negocios, bloqueo entre negocios, restricciones por rol, expiración y cierre de sesión, y aislamiento del modo demo.

## Alcance

La fase no incluye la interfaz Android ni la importación operativa de catálogos y ventas. El inventario, las ventas y los pronósticos existentes corresponden a componentes de otras fases.
