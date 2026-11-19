# Historial de la migración 001

Este documento registra la evidencia usada para decidir qué hacer con las bases
que pudieron aplicar la versión anterior de
[`001_esquema_inicial.sql`](../db/migraciones/001_esquema_inicial.sql). No se
editaron hashes ni registros de `migraciones`, y no se modificó ninguna base
compartida.

## 1. Versiones comparadas

| Origen | Contenido | SHA-256 canónico (LF) | SHA-256 con CRLF |
|---|---|---|---|
| Commit `43c2886` | DDL anterior, incompatible con la API actual (IDs numéricos y columna `email`) | `2d2e24dccc55d24d9b16dbec11e25c8609a18557964ba9d5aa0ec7a2c3460df3` | `00c0ff26216a1d2e311e3cd6958217d345da0805b4013a20d575cd6352391207` |
| Commit `f16e7a9` y posteriores | DDL actual: UUID `CHAR(36)`, productos textuales, `DECIMAL`, FK compuesta y `CHECK` | `195ff3490c0488e16793d122bdf60af481916f75e0935fa653cf3ef35f04e761` | `c01ad4280fb781ac970f36be826f6cf2be4e1e05d5c62516fd8b07483de5f163` |

La variante con CR simple del DDL anterior es
`7c15ef4f02fe3eba8d07548e735446d7e9e518cf2cf810c0c9975158c95d5799`. El runner
reconoce las tres variantes de finales de línea para no alterar registros ya
escritos en otras máquinas.

## 2. Evidencia consultada

Consultas realizadas en el MySQL local (8.0.46), sin escribir en las bases:

```sql
SHOW DATABASES LIKE 'proyecto%';
SELECT nombre, hash_sha256, aplicado_en FROM proyecto_renefull.migraciones;
```

Resultado:

- solo existe la base persistente `proyecto_renefull`;
- su registro de `001_esquema_inicial.sql` es
  `c01ad4280fb781ac970f36be826f6cf2be4e1e05d5c62516fd8b07483de5f163`, que
  corresponde al **DDL actual con CRLF**, no al DDL histórico;
- no existe ninguna base `proyectorenefull_test` ni otra base `proyecto%`.

También se verificaron en `proyecto_renefull` las tablas, columnas, tipos,
restricciones `UNIQUE`, `CHECK` y claves foráneas del esquema actual. El
resultado coincide con `ESQUEMA_ESPERADO` de `src/db/migraciones.js`.

## 3. Decisión

Como la única base persistente registró el contenido actual, **no hay bases
conocidas con el hash histórico**. Se conserva el `001` actual como esquema
inicial y no se reescribe su contenido ni el registro de `migraciones`.

El runner aplica estas reglas:

1. si el hash registrado coincide con el contenido actual (en cualquiera de sus
   variantes de finales de línea), la migración se omite y se verifica el esquema;
2. si el hash registrado es uno de los hashes históricos de `43c2886`, aborta
   con un mensaje que indica que el DDL aplicado era incompatible y que no se
   modificó la base;
3. si el hash no coincide con ninguna variante, aborta sin tocar la base.

En los casos 2 y 3 la base **no se modifica** y la tabla `migraciones` **no se
edita**. La conversión de una base histórica requiere una migración nueva
revisada por el equipo; no se ejecuta automáticamente.

## 4. Bases preexistentes sin registro

Si una base tiene tablas de negocio pero la tabla `migraciones` está vacía, el
runner verifica el esquema completo **antes** de ejecutar cualquier DDL:

- si coincide con el esquema esperado, registra `001` como verificada;
- si falta una tabla/columna, un tipo no coincide o aparece una tabla inesperada,
  aborta sin ejecutar DDL y sin registrar la migración.

Así una base ajena o un esquema viejo no queda a medio crear.

## 5. Diagnóstico de solo lectura y mensajes del runner

Antes de migrar, ejecute:

```bash
npm run db:diagnostico
```

El comando informa tipo y versión del servidor, disponibilidad de
`utf8mb4_0900_ai_ci`, usuario conectado, permisos de `SHOW GRANTS`, existencia
de la base configurada, sus tablas y las filas de `migraciones`. Clasifica el
hash de `001_esquema_inicial.sql` como actual, histórico `43c2886`, desconocido o
sin registro. No crea bases ni tablas.

| Mensaje o código | Acción segura |
|---|---|
| `El nombre de la base solo puede contener letras, números y guion bajo.` | Corregir `DB_NOMBRE` para que use únicamente esos caracteres. |
| `La base de pruebas debe empezar con "renefull_test_"` | Usar un nombre de pruebas con el prefijo exacto `renefull_test_`. |
| `No existe el directorio de migraciones` | Restaurar el archivo SQL esperado o ejecutar el comando desde la copia correcta del proyecto. |
| `... tiene tablas de negocio pero no registros de migración` | Detenerse y revisar el esquema antes de migrar. El runner no aplica DDL en ese caso. |
| `... contiene tablas que no pertenecen al esquema esperado` | Verificar `DB_NOMBRE`; no borrar ni renombrar tablas para forzar la migración. |
| `No hay una verificación de esquema registrada` | Agregar y revisar el verificador de esa migración antes de ejecutarla. |
| `... fue aplicada con el DDL anterior incompatible` | Conservar la base y preparar una migración de conversión revisada. No editar `migraciones`. |
| `... ya fue aplicada con otro contenido` | Restaurar el archivo original o crear una nueva migración; nunca editar una migración aplicada. |
| `El esquema existente no coincide con el esperado` | Revisar cada diferencia; el runner no alteró la base ni registró la migración. |
| `ER_ACCESS_DENIED_ERROR` / `ER_DBACCESS_DENIED_ERROR` | Corregir usuario, contraseña o permisos según `SHOW GRANTS`. |
| `ER_BAD_DB_ERROR` / permiso denegado al crear la base | Verificar el nombre y conceder `CREATE` sobre la base prevista. |
| `ER_UNKNOWN_COLLATION` / collation no disponible | Instalar MySQL 8.0.16 o superior con `utf8mb4_0900_ai_ci`; MariaDB no es compatible. |
| `ECONNREFUSED` / `ETIMEDOUT` | Iniciar el servidor y revisar host y puerto antes de repetir el diagnóstico. |

Para una base nueva o con una migración ya registrada con el hash actual, la
acción es `npm run db:migrar`. El comando verifica el esquema; si la migración
está pendiente, la aplica.

## 6. Permisos MySQL para desarrollo

Desde una sesión administrativa de MySQL, cree la base y la cuenta de la
aplicación. Sustituya la contraseña de muestra por una contraseña local que no
se guarde en Git:

```sql
CREATE DATABASE proyecto_renefull
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'renefull_app'@'127.0.0.1' IDENTIFIED BY 'CAMBIA_ESTA_CONTRASENA';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES
  ON proyecto_renefull.* TO 'renefull_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES
  ON `renefull\_test\_%`.* TO 'renefull_app'@'127.0.0.1';
```

Los privilegios de la base de prueba cubren exclusivamente nombres que empiezan
con `renefull_test_`; los guiones bajos se escapan porque MySQL los interpreta
como comodines en los nombres de bases usados por `GRANT`. La cuenta necesita
estos permisos para que `npm run test:integracion` cree y elimine sus bases
temporales. Para conectarse desde otra máquina, cree la cuenta para el host
correspondiente y configure `DB_HOST` y `DB_USUARIO` de forma acorde.
