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
