# Catálogo de validaciones y trazabilidad

Este catálogo reúne las reglas implementadas en la base de datos PostgreSQL y en
los servicios del backend. La validación visual de la aplicación móvil es
necesaria para la experiencia de usuario, pero no sustituye estas comprobaciones:
el servidor rechaza los datos inválidos aunque la petición llegue desde Postman,
curl u otro cliente.

## 1. Capas de validación

| Capa | Qué valida | Dónde se implementa |
| --- | --- | --- |
| Entrada de archivos | Estructura del JSON, metadata, filas y coherencia entre archivos. | `app/schemas/importacion.py` y `app/servicios/importacion.py` |
| Identidad y cuentas | Nombre, correo, contraseña, rol y estado activo. | `app/servicios/usuarios.py`, `app/seguridad/passwords.py` |
| Base de datos | Tipos, nulos, llaves, unicidad, rangos, coherencia y borrado restringido. | `app/db/models.py` y migración `0001_esquema_inicial.py` |
| Lectura | Forma de cada fila, fechas, precios, cantidades, total y origen. | `app/schemas/ventas.py` y `app/repositorios/ventas.py` |
| Autorización | Propietario de la sesión y rol administrativo consultado en la base. | `app/repositorios/ventas.py` y `app/servicios/usuarios.py` |
| Predicción | Semanas completas, historial mínimo y comparación contra línea base. | `app/ml/demanda.py` |

## 2. Validaciones de usuarios y contraseñas

| ID | Regla | Comportamiento | Capa |
| --- | --- | --- | --- |
| USR-01 | El nombre, sin espacios extremos, debe tener entre 1 y 120 caracteres. | `ValueError`; la base también lo rechaza. | Servicio y CHECK |
| USR-02 | El correo debe tener formato válido y se normaliza sin consultar entregabilidad. | `ValueError` si es inválido. | Servicio |
| USR-03 | El correo se almacena en minúsculas. | Normalización y CHECK `correo = lower(correo)`. | Servicio y CHECK |
| USR-04 | El correo es único. | `ConflictoUsuario`; UNIQUE en la base. | Servicio y UNIQUE |
| USR-05 | La contraseña debe tener entre 12 y 128 caracteres. | `ValueError`. | Servicio |
| USR-06 | La contraseña debe incluir al menos una letra y un dígito. | `ValueError`. | Servicio |
| USR-07 | La contraseña no puede empezar ni terminar con espacios. | `ValueError`. | Servicio |
| USR-08 | La contraseña no puede ser igual al correo. | `ValueError`. | Servicio |
| USR-09 | Solo se almacena un hash Argon2id con prefijo `$argon2id$`. | CHECK en la base; el servicio nunca guarda texto claro. | Servicio y CHECK |
| USR-10 | El rol solo puede ser `cliente` o `administrador`. | CHECK en la base. | CHECK |
| USR-11 | El registro público siempre crea `cliente`; no acepta rol. | `crear_cliente` fija el rol. | Servicio |
| USR-12 | Las operaciones administrativas exigen una cuenta activa con rol `administrador`. | `PermisoDenegado`. | Servicio |
| USR-13 | Solo se promueve una cuenta cliente activa. | `NoEncontrado` o `OperacionNoPermitida`. | Servicio |
| USR-14 | La inicialización del primer administrador rechaza crear otro sin autorización explícita. | `OperacionNoPermitida`. | Servicio |

## 3. Validaciones de catálogo

| ID | Regla | Comportamiento | Capa |
| --- | --- | --- | --- |
| CAT-01 | El nombre de categoría, sin espacios extremos, debe tener entre 1 y 60 caracteres. | `ValueError`; CHECK en la base. | Servicio y CHECK |
| CAT-02 | El nombre de categoría es único. | UNIQUE en la base. | UNIQUE |
| PRO-01 | El ID de producto debe cumplir `^[A-Z]{1,3}[0-9]{3}$`. | CHECK en la base y validación de archivo. | CHECK y Pydantic |
| PRO-02 | El nombre de producto debe tener entre 1 y 120 caracteres. | CHECK en la base. | CHECK |
| PRO-03 | El precio actual debe ser mayor que cero. | CHECK en la base. | CHECK |
| PRO-04 | La categoría del producto debe existir. | FK con `ON DELETE RESTRICT`. | FK |
| PRO-05 | Un mismo `producto_id` debe conservar nombre y categoría en todos los archivos. | `ErrorValidacionArchivo` con fila y campo. | Servicio |

## 4. Validaciones de importaciones

| ID | Regla | Comportamiento | Capa |
| --- | --- | --- | --- |
| IMP-01 | El JSON debe ser un objeto con `metadata` y `ventas`. | `ErrorValidacionArchivo`. | Servicio |
| IMP-02 | El archivo debe ser UTF-8 y JSON válido. | `ErrorValidacionArchivo`. | Servicio |
| IMP-03 | `metadata.conjunto` y `metadata.perfil_demanda` deben tener entre 1 y 80 caracteres. | `ErrorValidacionArchivo`. | Pydantic |
| IMP-04 | `metadata.datos_simulados` debe ser `true`. | `ErrorValidacionArchivo`. | Pydantic |
| IMP-05 | `metadata.moneda` debe ser `MXN`. | CHECK en la base y validación de archivo. | Pydantic y CHECK |
| IMP-06 | `periodo_inicio` no puede ser posterior a `periodo_fin`. | `ErrorValidacionArchivo`; CHECK en la base. | Pydantic y CHECK |
| IMP-07 | `cantidad_registros` debe ser mayor que cero y coincidir con la lista. | `ErrorValidacionArchivo`; CHECK en la base. | Pydantic, servicio y CHECK |
| IMP-08 | El hash debe tener 64 caracteres hexadecimales y ser único. | CHECK y UNIQUE en la base. | Servicio y CHECK |
| IMP-09 | El propietario debe existir, estar activo y ser `cliente`. | `OperacionNoPermitida`. | Servicio |
| IMP-10 | El importador, si se indica, debe ser administrador. | `OperacionNoPermitida` en el comando de carga. | CLI |
| IMP-11 | El mismo conjunto con el mismo contenido es idempotente. | Resultado `ya_importado`, sin duplicar ventas. | Servicio |
| IMP-12 | El mismo conjunto con otro contenido es conflicto. | `ConflictoImportacion`; no se escribe. | Servicio |
| IMP-13 | El mismo hash con otro conjunto es conflicto. | `ConflictoImportacion`; no se escribe. | Servicio |
| IMP-14 | Un fallo en cualquier archivo revierte la carga completa. | Rollback de la transacción. | CLI y servicio |

## 5. Validaciones de ventas

| ID | Regla | Comportamiento | Capa |
| --- | --- | --- | --- |
| VEN-01 | `id_venta` debe cumplir `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`. | `ErrorValidacionArchivo`. | Pydantic |
| VEN-02 | `id_venta` no puede repetirse dentro del archivo. | `ErrorValidacionArchivo` con fila. | Servicio |
| VEN-03 | `fecha` debe ser igual o posterior a `2000-01-01`. | `ErrorValidacionArchivo`; CHECK en la base. | Pydantic y CHECK |
| VEN-04 | `fecha` no puede ser futura; se permite un día de margen por zona horaria. | `ErrorValidacionArchivo`; filtro de lectura. | Pydantic, SQL y CHECK |
| VEN-05 | `fecha` debe estar dentro del periodo declarado en la metadata. | `ErrorValidacionArchivo`. | Servicio |
| VEN-06 | `producto_id` debe cumplir `^[A-Z]{1,3}[0-9]{3}$`. | `ErrorValidacionArchivo`; CHECK en la base. | Pydantic y CHECK |
| VEN-07 | `producto` debe tener entre 1 y 120 caracteres. | `ErrorValidacionArchivo`; CHECK en la base. | Pydantic y CHECK |
| VEN-08 | `categoria` debe tener entre 1 y 60 caracteres. | `ErrorValidacionArchivo`; CHECK en la base. | Pydantic y CHECK |
| VEN-09 | El producto debe existir y su categoría debe coincidir con el catálogo. | `ErrorValidacionArchivo`. | Servicio |
| VEN-10 | `precio_unitario_mxn` debe ser finito, mayor que cero, menor o igual a 1,000,000 y tener máximo dos decimales. | `ErrorValidacionArchivo`; CHECK en la base. | Pydantic y CHECK |
| VEN-11 | `cantidad` debe ser un entero entre 1 y 10,000. | `ErrorValidacionArchivo`; CHECK en la base. | Pydantic y CHECK |
| VEN-12 | `total_mxn` debe ser finito, mayor que cero, menor o igual a 10,000,000 y tener máximo dos decimales. | `ErrorValidacionArchivo`; CHECK en la base. | Pydantic y CHECK |
| VEN-13 | `abs(total_mxn - precio_unitario_mxn * cantidad) <= 0.01`. | `ErrorValidacionArchivo`; CHECK en la base. | Pydantic y CHECK |
| VEN-14 | `importacion_id` e `id_origen` deben estar ambos presentes o ambos ausentes. | CHECK en la base y validación de lectura. | CHECK y Pydantic |
| VEN-15 | `id_origen` debe tener entre 1 y 64 caracteres si existe. | CHECK en la base. | CHECK |
| VEN-16 | La pareja `(importacion_id, id_origen)` debe ser única. | Índice único parcial. | UNIQUE parcial |
| VEN-17 | La importación y la venta deben pertenecer al mismo propietario. | FK compuesta. | FK |
| VEN-18 | La pareja `(propietario_id, clave_idempotencia)` debe ser única. | Índice único parcial. | UNIQUE parcial |
| VEN-19 | Las filas leídas deben cumplir el esquema `VentaLeida`. | Filas inválidas se excluyen del listado. | Pydantic |
| VEN-20 | La consulta individual de una fila inválida debe fallar de forma controlada. | `RegistroInvalido`. | Repositorio |
| VEN-21 | Una venta de otro cliente no debe revelarse. | `NoEncontrado`. | Repositorio |
| VEN-22 | La paginación debe tener límite entre 1 y 500 y desplazamiento no negativo. | `ValueError`. | Repositorio |

## 6. Validaciones de lectura y autorización

| ID | Regla | Comportamiento | Capa |
| --- | --- | --- | --- |
| LEC-01 | Las consultas de cliente reciben el propietario desde la identidad autenticada. | Filtro SQL obligatorio. | Repositorio |
| LEC-02 | Cambiar el ID de una venta no debe devolver datos de otro cliente. | `NoEncontrado`. | Repositorio |
| LEC-03 | Las operaciones administrativas verifican el rol en la base. | `PermisoDenegado`. | Servicio |
| LEC-04 | Las cuentas inactivas no se usan como propietarios válidos. | Fila excluida o `RegistroInvalido`. | SQL y Pydantic |
| LEC-05 | Las filas inválidas se excluyen de estadísticas y predicciones. | `registros_excluidos` y series construidas solo con filas válidas. | Repositorio |
| LEC-06 | El listado administrativo solo incluye cuentas `cliente`. | Filtro por rol. | Servicio |
| LEC-07 | El administrador debe estar activo y tener rol `administrador`. | `PermisoDenegado`. | Servicio |

## 7. Validaciones de la predicción

| ID | Regla | Comportamiento | Capa |
| --- | --- | --- | --- |
| ML-01 | Solo se usan semanas completas. | Se descartan la primera y la última semana parciales. | Modelo |
| ML-02 | Se requieren al menos 12 semanas completas y 8 con unidades positivas por defecto. | `sin_historial_suficiente`. | Modelo y configuración |
| ML-03 | Se reservan 5 semanas para evaluación cronológica. | Corte temporal antes de entrenar. | Modelo |
| ML-04 | El modelo debe superar el MAE de la línea base. | `modelo_no_supera_linea_base` si no lo supera. | Modelo |
| ML-05 | La salida debe indicar periodo, unidad, algoritmo, variables y métricas. | Esquema tipado de resultado. | Pydantic |
| ML-06 | La predicción es una estimación y no se persiste. | `es_estimacion = true`; cálculo bajo demanda. | Modelo y esquema |
| ML-07 | La fuente debe distinguir datos simulados de datos reales. | `fuente_datos` se deriva de las importaciones. | Modelo |

## 8. Errores y respuestas

| Error de dominio | Situación | Respuesta prevista en la capa HTTP |
| --- | --- | --- |
| `ErrorValidacionArchivo` | Archivo o fila inválida. | `400` o `422` con archivo, fila, campo y motivo. |
| `ConflictoImportacion` | Conjunto o hash ya existente con otro contenido. | `409`. |
| `ConflictoUsuario` | Correo duplicado. | `409`. |
| `NoEncontrado` | Venta, usuario o cliente inexistente o ajeno. | `404`. |
| `RegistroInvalido` | Registro propio que no cumple las reglas. | `422` con motivos. |
| `PermisoDenegado` | Actor sin rol administrativo activo. | `403`. |
| `OperacionNoPermitida` | Operación no admitida por el estado del recurso. | `403` o `409` según el caso. |
| `ValueError` | Parámetro fuera de rango o formato inválido. | `400` o `422`. |

Las rutas HTTP no forman parte de esta rama; la tabla documenta la traducción
que deberá aplicar la capa de integración sin exponer detalles internos de SQL.

## 9. Trazabilidad de pruebas

La suite se ejecutó contra una base PostgreSQL desechable, recreando el esquema
`public` y aplicando todas las migraciones.

| Área | Archivo | Pruebas representativas |
| --- | --- | --- |
| Esquema y migración | `tests/test_migracion.py` | `test_migracion_crea_todas_las_tablas`, `test_migracion_crea_indices_y_restricciones_de_ventas`, `test_migracion_tiene_revision_actual` |
| Restricciones de base de datos | `tests/test_restricciones_db.py` | `test_db_rechaza_venta_con_total_incoherente`, `test_db_rechaza_cantidad_fuera_de_rango`, `test_db_rechaza_rol_desconocido`, `test_db_rechaza_hash_que_no_es_argon2id`, `test_db_rechaza_venta_ligada_a_importacion_de_otro_cliente` |
| Estructura de archivos | `tests/test_importacion.py` | `test_cargar_archivo_valido`, `test_cargar_directorio_encuentra_los_cinco_conjuntos`, `test_archivo_inexistente_es_error_controlado`, `test_archivo_con_campo_faltante_es_rechazado` |
| Reglas de filas | `tests/test_importacion.py` | `test_archivo_con_fecha_invalida_es_rechazado`, `test_archivo_con_cantidad_cero_es_rechazado`, `test_archivo_con_total_incoherente_es_rechazado`, `test_categoria_demasiado_larga_es_rechazada`, `test_precio_con_mas_de_dos_decimales_es_rechazado`, `test_archivo_con_id_repetido_es_rechazado`, `test_archivo_con_producto_inconsistente_es_rechazado`, `test_archivo_sin_ventas_es_rechazado` |
| Persistencia e idempotencia | `tests/test_importacion.py` | `test_importar_archivo_valido_persiste_ventas_y_origen`, `test_reimportar_el_mismo_archivo_es_idempotente`, `test_mismo_conjunto_con_contenido_distinto_es_conflicto`, `test_mismo_hash_con_otro_conjunto_es_conflicto` |
| Catálogo y transacciones | `tests/test_importacion.py` | `test_producto_fuera_del_catalogo_es_rechazado`, `test_categoria_fuera_del_catalogo_es_rechazada`, `test_fallo_a_mitad_de_la_carga_no_deja_datos`, `test_propietario_debe_ser_cliente_activo`, `test_cargar_demo_completo_y_repetible`, `test_sembrar_catalogo_crea_categorias_y_productos` |
| Cuentas y contraseñas | `tests/test_passwords_usuarios.py` | `test_hash_argon2id_y_verificacion`, `test_politica_de_contrasena_rechaza_valores_debiles`, `test_contrasena_no_puede_ser_igual_al_correo`, `test_crear_cliente_siempre_asigna_rol_cliente`, `test_correo_duplicado_es_rechazado`, `test_correo_invalido_es_rechazado`, `test_inicializacion_de_administrador_y_promocion`, `test_admin_ve_solo_clientes_en_el_listado` |
| Aislamiento y lectura | `tests/test_consultas.py` | `test_estadisticas_cliente_desde_base_de_datos`, `test_aislamiento_entre_clientes`, `test_cambiar_propietario_no_expone_ventas_ajenas`, `test_admin_no_puede_ser_simulado_por_cliente`, `test_fila_invalida_es_excluida_de_estadisticas_y_falla_individual`, `test_venta_de_propietario_inactivo_es_invalida`, `test_paginacion_valida_limites`, `test_cliente_sin_ventas_devuelve_estadisticas_vacias` |
| Agregados administrativos | `tests/test_consultas.py` | `test_periodos_semanales_marcan_semanas_incompletas`, `test_periodos_mensuales_marcan_meses_incompletos`, `test_estadisticas_admin_agregan_solo_clientes`, `test_listar_clientes_admin_no_incluye_administradores` |
| Modelo de demanda | `tests/test_ml.py` | `test_serie_semanal_solo_incluye_semanas_completas`, `test_construir_muestras_respeta_corte_cronologico`, `test_cliente_sin_ventas_no_inventa_prediccion`, `test_historial_insuficiente_no_inventa_prediccion`, `test_modelo_que_no_supera_linea_base_no_publica_estimacion`, `test_prediccion_con_tendencia_es_estimacion_y_es_deterministica`, `test_demo_carga_todas_las_categorias_y_clasifica_fuente` |

## 10. Resultados de la última ejecución

```text
62 passed
```

También se verificó:

- `alembic upgrade head`, `alembic downgrade base` y una nueva actualización.
- `alembic check` sin operaciones nuevas pendientes.
- `compileall` sobre `app`, `tests` y `migrations`.
- Carga repetida de los cinco conjuntos: 5 importaciones, 500 ventas, 1,287
  unidades y 36,404.00 MXN, sin duplicados.
- Predicciones de demostración: cuatro categorías con estimación y dos con
  `modelo_no_supera_linea_base`.

No hubo pruebas fallidas. Las pruebas de rutas HTTP, autenticación y frontend
pertenecen a las ramas de integración y no se ejecutaron aquí.
