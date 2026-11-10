# Contrato propuesto: base de datos, consultas y Machine Learning

Estado: aprobado por el equipo e implementado en la rama `Ismael`. Pendiente la revisión del PR; no se fusiona desde esta rama.

Alcance de esta rama: base de datos PostgreSQL, migraciones, carga de los conjuntos de demostración, consultas analíticas y módulo de Machine Learning dentro de `Backend/`. Las rutas HTTP, la autenticación y la aplicación móvil quedan fuera de esta rama.

## 1. Stack confirmado

| Componente | Decisión |
| --- | --- |
| Lenguaje | Python 3.12 o superior |
| API | FastAPI |
| Base de datos | PostgreSQL 16 o superior |
| ORM y migraciones | SQLAlchemy 2.x y Alembic |
| Driver | psycopg 3 |
| Validación | Pydantic 2 |
| Contraseñas | Argon2id mediante `argon2-cffi` |
| Machine Learning | scikit-learn |
| Pruebas | pytest |

El frontend existente usa Kotlin y Jetpack Compose. Esta rama no modifica `FrontEnd/`.

## 2. Datos de demostración

Los cinco conjuntos están en `Backend/data/demo/`. Provienen de la rama `Atr-Tako` y se copiaron sin regenerarlos ni alterarlos.

| Archivo | Conjunto | Perfil | Ventas | Unidades | Importe MXN |
| --- | --- | --- | ---: | ---: | ---: |
| `ventas_sucursal_demo_01.json` | `sucursal_demo_01` | balanceado | 100 | 250 | 7,897.00 |
| `ventas_sucursal_demo_02.json` | `sucursal_demo_02` | mayor demanda de bebidas | 100 | 268 | 6,879.50 |
| `ventas_sucursal_demo_03.json` | `sucursal_demo_03` | mayor demanda de abarrotes | 100 | 254 | 6,648.00 |
| `ventas_sucursal_demo_04.json` | `sucursal_demo_04` | mayor demanda de higiene y limpieza | 100 | 248 | 7,318.00 |
| `ventas_sucursal_demo_05.json` | `sucursal_demo_05` | mayor demanda de botanas y lácteos | 100 | 267 | 7,661.50 |
| **Total** | | | **500** | **1,287** | **36,404.00** |

Características verificadas de los archivos:

- `metadata.datos_simulados` es `true` en los cinco conjuntos.
- Periodo declarado: `2026-01-01` a `2026-06-30`.
- 41 productos y 6 categorías: Abarrotes, Bebidas, Botanas, Higiene, Lácteos y Limpieza.
- 500 identificadores de venta únicos con patrón `D01-001` a `D05-100`.
- Cantidades enteras entre 1 y 5; precios entre 12.00 y 72.00 MXN.
- `precio_unitario_mxn * cantidad` coincide con `total_mxn` en las 500 filas.
- El mismo `producto_id` conserva nombre y categoría en todos los archivos.
- El periodo abarca 27 semanas ISO. La semana W01 (2026-01-01 a 2026-01-04) y la W27 (2026-06-29 a 2026-06-30) son parciales; para el modelo se usarán únicamente las 25 semanas completas W02 a W26.

Estos datos son simulados y de demostración. No representan ventas reales de una empresa, sucursal o profesor. La API no consultará los JSON en tiempo de ejecución: solo se usarán para la carga inicial.

## 3. Principios de seguridad y propiedad

1. El servidor obtiene la identidad y el rol de la sesión autenticada. Ninguna función de base de datos acepta un rol, propietario o identificador de cliente enviado por el cuerpo, la URL o un cliente HTTP.
2. Las consultas de cliente reciben obligatoriamente el `propietario_id` derivado de la sesión. No existe una variante que permita consultar ventas de otro cliente cambiando un ID.
3. Las consultas administrativas son funciones separadas que reciben el `actor_admin_id` de la sesión y verifican en la base de datos que la cuenta exista, esté activa y tenga rol `administrador`. El controlador también debe verificar el rol antes de llamarlas; la comprobación de la capa de datos es defensa en profundidad.
4. El registro público siempre crea `cliente`. El campo `rol` no se acepta desde el registro.
5. Las contraseñas se almacenan exclusivamente como hash Argon2id. Nunca se guardan contraseñas, hashes, tokens ni credenciales reales en Git.
6. Las filas inválidas se excluyen de listados, estadísticas y predicciones. La consulta individual de una fila inválida produce un error controlado.
7. Las predicciones son estimaciones. Siempre indican unidad, periodo, algoritmo, métricas y carácter estimado. Si no hay historial suficiente o el modelo no supera la línea base, se informa la limitación y no se fabrica una predicción.

## 4. Modelo conceptual

```mermaid
erDiagram
    USUARIOS ||--o{ VENTAS : posee
    USUARIOS ||--o{ IMPORTACIONES : importa
    CATEGORIAS ||--o{ PRODUCTOS : agrupa
    PRODUCTOS ||--o{ VENTAS : registra
    IMPORTACIONES ||--o{ VENTAS : contiene

    USUARIOS {
        uuid id PK
        varchar nombre
        varchar correo UK
        text password_hash
        varchar rol
        boolean activo
        timestamptz creado_en
        timestamptz actualizado_en
    }
    CATEGORIAS {
        smallint id PK
        varchar nombre UK
    }
    PRODUCTOS {
        varchar id PK
        varchar nombre
        smallint categoria_id FK
        numeric precio_actual_mxn
        boolean activo
    }
    IMPORTACIONES {
        bigint id PK
        varchar conjunto UK
        varchar archivo
        char hash_sha256 UK
        varchar perfil_demanda
        boolean es_demostracion
        date periodo_inicio
        date periodo_fin
        integer cantidad_registros
        uuid propietario_id FK
        uuid importado_por FK
        timestamptz importado_en
    }
    VENTAS {
        bigint id PK
        bigint importacion_id FK
        varchar id_origen
        uuid propietario_id FK
        date fecha
        varchar producto_id FK
        numeric precio_unitario_mxn
        integer cantidad
        numeric total_mxn
        uuid clave_idempotencia
        timestamptz creado_en
    }
```

No se persisten predicciones en esta versión. Se calculan bajo demanda a partir de ventas válidas almacenadas.

## 5. Esquema propuesto

Los nombres son propuesta para alinear con Mia-Paola antes de crear la migración.

### 5.1 `usuarios`

| Columna | Tipo | Restricciones |
| --- | --- | --- |
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `nombre` | `varchar(120)` | `NOT NULL`, longitud recortada entre 1 y 120 |
| `correo` | `varchar(254)` | `NOT NULL`, `UNIQUE`, almacenado en minúsculas |
| `password_hash` | `text` | `NOT NULL`, debe comenzar con `$argon2id$` |
| `rol` | `varchar(20)` | `NOT NULL`, `CHECK (rol IN ('cliente','administrador'))` |
| `activo` | `boolean` | `NOT NULL DEFAULT true` |
| `creado_en` | `timestamptz` | `NOT NULL DEFAULT now()` |
| `actualizado_en` | `timestamptz` | `NOT NULL DEFAULT now()` |

Índices: único sobre `correo`; índice sobre `rol`.

El hash nunca se incluye en los modelos de respuesta. La promoción cambia `rol` de `cliente` a `administrador` dentro de una transacción y solo puede ejecutarse desde una función administrativa.

### 5.2 `categorias`

| Columna | Tipo | Restricciones |
| --- | --- | --- |
| `id` | `smallint` | PK, identidad |
| `nombre` | `varchar(60)` | `NOT NULL`, `UNIQUE` |

La tabla evita aceptar categorías desconocidas y permite filtrar sin duplicar texto libre.

### 5.3 `productos`

| Columna | Tipo | Restricciones |
| --- | --- | --- |
| `id` | `varchar(20)` | PK, patrón `^[A-Z]{1,3}[0-9]{3}$` |
| `nombre` | `varchar(120)` | `NOT NULL`, no vacío |
| `categoria_id` | `smallint` | `NOT NULL`, FK a `categorias(id)` |
| `precio_actual_mxn` | `numeric(12,2)` | `NOT NULL`, `> 0` |
| `activo` | `boolean` | `NOT NULL DEFAULT true` |
| `creado_en` | `timestamptz` | `NOT NULL DEFAULT now()` |
| `actualizado_en` | `timestamptz` | `NOT NULL DEFAULT now()` |

Índice sobre `categoria_id`.

El precio histórico de cada venta se conserva en `ventas.precio_unitario_mxn`; cambiar `productos.precio_actual_mxn` no altera ventas anteriores.

### 5.4 `importaciones`

| Columna | Tipo | Restricciones |
| --- | --- | --- |
| `id` | `bigint` | PK, identidad |
| `conjunto` | `varchar(80)` | `NOT NULL`, `UNIQUE` |
| `archivo` | `varchar(255)` | `NOT NULL` |
| `hash_sha256` | `varchar(64)` | `NOT NULL`, `UNIQUE` |
| `perfil_demanda` | `varchar(80)` | `NOT NULL` |
| `fuente` | `varchar(40)` | `NOT NULL DEFAULT 'datos_simulados'` |
| `es_demostracion` | `boolean` | `NOT NULL DEFAULT true` |
| `moneda` | `varchar(3)` | `NOT NULL DEFAULT 'MXN'`, `CHECK (moneda = 'MXN')` |
| `periodo_inicio` | `date` | `NOT NULL` |
| `periodo_fin` | `date` | `NOT NULL`, `>= periodo_inicio` |
| `cantidad_registros` | `integer` | `NOT NULL`, `> 0` |
| `propietario_id` | `uuid` | `NOT NULL`, FK a `usuarios(id)` |
| `importado_por` | `uuid` | FK a `usuarios(id)`, nullable |
| `importado_en` | `timestamptz` | `NOT NULL DEFAULT now()` |

Restricción compuesta: `UNIQUE (id, propietario_id)` para que las ventas importadas no puedan quedar asignadas a un propietario distinto del declarado en la importación.

### 5.5 `ventas`

| Columna | Tipo | Restricciones |
| --- | --- | --- |
| `id` | `bigint` | PK, identidad |
| `importacion_id` | `bigint` | FK a `importaciones(id)`, nullable para ventas creadas por API |
| `id_origen` | `varchar(64)` | Identificador del archivo, nullable para ventas de API |
| `propietario_id` | `uuid` | `NOT NULL`, FK a `usuarios(id)` |
| `fecha` | `date` | `NOT NULL`, `>= DATE '2000-01-01'` |
| `producto_id` | `varchar(20)` | `NOT NULL`, FK a `productos(id)` |
| `precio_unitario_mxn` | `numeric(12,2)` | `NOT NULL`, `> 0` |
| `cantidad` | `integer` | `NOT NULL`, entre 1 y 10,000 |
| `total_mxn` | `numeric(14,2)` | `NOT NULL`, `> 0` |
| `clave_idempotencia` | `uuid` | Nullable; única por propietario cuando existe |
| `creado_en` | `timestamptz` | `NOT NULL DEFAULT now()` |

Restricciones e índices:

- `CHECK (abs(total_mxn - precio_unitario_mxn * cantidad) <= 0.01)`.
- `CHECK ((importacion_id IS NULL) = (id_origen IS NULL))`.
- FK compuesta `(importacion_id, propietario_id)` a `importaciones(id, propietario_id)` cuando `importacion_id` no es nulo.
- `UNIQUE (importacion_id, id_origen)` parcial, solo cuando `importacion_id` no es nulo, para impedir duplicados dentro de una importación.
- `UNIQUE (propietario_id, clave_idempotencia)` para reintentos seguros de ventas creadas por API.
- Índices: `(propietario_id, fecha)`, `(producto_id, fecha)`, `(fecha)`, `(importacion_id)`.
- La fecha futura no se impone con `CURRENT_DATE` en la base porque no es inmutable; se valida en backend con una tolerancia de un día.

`cantidad` significa unidades vendidas. El número de transacciones se reporta por separado como `transacciones` o `numero_ventas`; nunca se mezclan ambas medidas.

## 6. Reglas de validación

### 6.1 Validación de archivos de importación

El cargador rechaza el archivo completo, sin dejar carga parcial, cuando ocurra cualquiera de estas condiciones:

- Falta `metadata` o `ventas`, o no son del tipo esperado.
- `metadata.datos_simulados` no es `true`.
- `moneda` no es `MXN`.
- `periodo_inicio` o `periodo_fin` no tienen formato ISO `YYYY-MM-DD`, o el inicio es posterior al fin.
- `cantidad_registros` no coincide con la cantidad de elementos de `ventas`.
- Una venta no tiene todos los campos obligatorios.
- `id_venta` está vacío, se repite o no cumple el patrón acordado.
- `fecha` no es ISO, es anterior a 2000-01-01, es posterior a hoy + 1 día o queda fuera del periodo declarado.
- `producto_id` no existe en el catálogo; el catálogo conserva productos históricos aunque ya no estén activos.
- `categoria` no existe o no coincide con la categoría del producto.
- `precio_unitario_mxn` no es numérico, es menor o igual a cero, o excede el límite acordado.
- `cantidad` no es entero positivo o excede 10,000.
- `total_mxn` no es numérico, es menor o igual a cero, o difiere de `precio * cantidad` en más de 0.01.
- El mismo `conjunto` ya fue importado con un contenido distinto.

El error reporta `archivo`, `fila` (posición dentro de `ventas`), `campo` y `motivo`. La transacción se revierte completa.

### 6.2 Validación de filas leídas

Antes de devolver datos:

- `usuarios`: UUID válido, nombre no vacío, correo válido y normalizado, rol permitido, `activo` booleano, hash Argon2id cuando se lee para autenticación y nunca para respuestas.
- `productos`: identificador con patrón válido, nombre no vacío, categoría existente, precio actual mayor que cero.
- `ventas`: propietario existente y activo, fecha válida y no futura, producto existente, categoría coherente, precio y cantidad positivos, total coherente, importación coherente cuando aplica.
- `importaciones`: conjunto y hash presentes, marca de demostración, periodo coherente, propietario con rol cliente.

Las filas inválidas se excluyen de listados, estadísticas y entrenamiento. El resultado incluye `registros_excluidos` para que la interfaz pueda informar que hay datos descartados. La consulta individual de una fila inválida lanza `RegistroInvalido`, que el controlador traduce a un error controlado sin exponer detalles internos.

### 6.3 Validación en la API

Los modelos Pydantic de entrada validan tipos, longitudes, fechas, correo, cantidades, precios y total. La base de datos y los validadores de lectura repiten las comprobaciones esenciales; la seguridad no depende de la validación visual del frontend.

## 7. Carga de demostración

### 7.1 Orden de operaciones

1. Crear la base y aplicar migraciones con Alembic.
2. Cargar el catálogo de categorías y productos a partir de los JSON.
3. Crear el administrador inicial mediante el script documentado.
4. Crear el cliente de demostración y asignarle los conjuntos.
5. Importar los cinco archivos dentro de una sola transacción. Si un archivo falla, se revierte también el catálogo y cualquier importación previa de esa ejecución.

### 7.2 Idempotencia

Cada archivo se identifica por `metadata.conjunto` y por el SHA-256 de su contenido. Si ya existe una importación con el mismo conjunto y el mismo hash, el cargador no inserta nada y reporta `ya_importado`. Si el conjunto existe con otro hash, reporta `conflicto_importacion` y no modifica datos. La restricción única `(importacion_id, id_origen)` impide duplicar ventas dentro de una importación.

### 7.3 Asignación de propietario

Propuesta recomendada: un cliente de demostración es propietario de los cinco conjuntos. Así se conservan los cinco perfiles de demanda en `importaciones` y se obtienen 500 ventas y 25 semanas completas para el módulo ML. El administrador consulta agregados por cliente y por categoría.

Alternativa: un cliente por conjunto. El administrador vería cinco filas y cinco gráficas, pero cada cliente tendría series semanales por categoría mucho más dispersas y el modelo podría responder `sin_historial_suficiente` con frecuencia. Esta alternativa requiere aprobación explícita.

### 7.4 Credenciales de demostración

Las contraseñas de demostración se proporcionan por variables de entorno o se solicitan de forma interactiva. No se escriben en archivos versionados. Ejemplo de variables, sin valores reales:

```text
DATABASE_URL=postgresql+psycopg://usuario:clave@localhost:5432/proyectorenefull
ADMIN_CORREO=<correo-del-administrador>
ADMIN_NOMBRE=<nombre-del-administrador>
ADMIN_PASSWORD=<contraseña-definida-fuera-del-repositorio>
DEMO_CLIENTE_CORREO=<correo-del-cliente-demo>
DEMO_CLIENTE_NOMBRE=<nombre-del-cliente-demo>
DEMO_CLIENTE_PASSWORD=<contraseña-definida-fuera-del-repositorio>
```

El script de administrador:

- Verifica que la contraseña no esté vacía y cumpla la política acordada.
- Genera el hash Argon2id y lo guarda.
- Es seguro ante reintentos: si ya existe una cuenta administradora, se detiene salvo que se use explícitamente `--permitir-adicional`; no actualiza contraseñas existentes.
- No imprime la contraseña ni el hash.

Parámetros Argon2id propuestos: `time_cost=3`, `memory_cost=65536` KiB, `parallelism=4`, `hash_len=32`, `salt_len=16`. Se almacena la cadena PHC completa.

## 8. Consultas analíticas

### 8.1 Unidades y agrupación

- `unidades`: suma de `ventas.cantidad`. Es la medida principal.
- `transacciones`: conteo de ventas válidas.
- `importe_mxn`: suma de `ventas.total_mxn`.
- Agrupación semanal: lunes a domingo, usando la fecha calendario almacenada. La semana se etiqueta con su fecha de inicio y su número ISO.
- Agrupación mensual: mes calendario.
- Las semanas parciales se incluyen en estadísticas con la marca `completa: false`; el modelo las excluye.
- No se convierten fechas a otra zona horaria porque son fechas calendario sin hora. Los timestamps de creación se guardan en UTC.

### 8.2 Estadísticas de cliente

Función propuesta:

```text
estadisticas_cliente(
    session,
    propietario_id: UUID,
    desde: date | None,
    hasta: date | None,
    agrupacion: Literal["semana", "mes"]
) -> EstadisticasCliente
```

Forma de salida:

```json
{
  "unidad_cantidad": "unidades",
  "periodo": {
    "desde": "2026-01-01",
    "hasta": "2026-06-30",
    "agrupacion": "semana"
  },
  "resumen": {
    "transacciones_validas": 500,
    "unidades": 1287,
    "importe_mxn": 36404.00,
    "registros_excluidos": 0
  },
  "por_categoria": [
    {
      "categoria": "Bebidas",
      "transacciones": 111,
      "unidades": 324,
      "importe_mxn": 8671.00
    }
  ],
  "por_semana": [
    {
      "periodo_inicio": "2026-01-05",
      "periodo_fin": "2026-01-11",
      "etiqueta": "2026-W02",
      "completa": true,
      "categoria": "Bebidas",
      "transacciones": 4,
      "unidades": 12,
      "importe_mxn": 364.00
    }
  ],
  "por_producto": [
    {
      "producto_id": "B003",
      "producto": "Jugo de naranja 1 L",
      "categoria": "Bebidas",
      "transacciones": 6,
      "unidades": 18,
      "importe_mxn": 558.00
    }
  ]
}
```

La respuesta de cliente nunca incluye ventas ni agregados de otro propietario.

### 8.3 Estadísticas administrativas

Función propuesta:

```text
estadisticas_clientes_admin(
    session,
    actor_admin_id: UUID,
    desde: date | None,
    hasta: date | None,
    agrupacion: Literal["semana", "mes"],
    hoy: date | None
) -> EstadisticasAdmin
```

Devuelve una fila por cliente con `cliente_id`, `nombre`, `correo`, `transacciones`, `unidades`, `importe_mxn`, `ultima_venta` y `registros_excluidos`, además de series por categoría para la gráfica. El administrador recibe agregados, no el detalle individual de ventas de cada cliente. El controlador debe verificar el rol antes de llamar a esta función.

### 8.4 Aislamiento

Todas las consultas de cliente incluyen `propietario_id = :propietario_id_autenticado`. Si se solicita un recurso de otro propietario, la respuesta es equivalente a no encontrado; no se revela su existencia. Las funciones administrativas son distintas y no comparten el mismo camino de autorización.

## 9. Machine Learning

### 9.1 Objetivo

Estimar las unidades vendidas por categoría para la siguiente semana completa de un cliente. La unidad de predicción es `unidades`; el periodo es una semana ISO completa.

No se predice por producto en esta versión: con 25 semanas completas y 41 productos, la serie por producto sería demasiado dispersa.

### 9.2 Serie de entrada

Para cada categoría:

- Se toman únicamente ventas válidas del propietario solicitado.
- Se agrupan por semana ISO completa.
- Se excluyen la primera y la última semana si son parciales.
- Se rellenan con cero las semanas completas sin ventas de esa categoría, para mantener una serie regular.
- Se ordena cronológicamente.

### 9.3 Variables del modelo

Para cada semana `t`:

- `indice_semana`: tendencia entera.
- `mes`: mes calendario de la semana.
- `unidades_semana_anterior`: valor de `t-1`.
- `promedio_4_semanas_previas`: media de `t-4` a `t-1`.
- `unidades_misma_semana_mes_anterior`: valor de la semana situada cuatro semanas antes, que representa la semana equivalente del mes anterior.

Todas las variables se calculan solo con información anterior a `t`. No se usan datos del futuro.

### 9.4 Entrenamiento y evaluación

- Orden cronológico, sin mezclar ni barajar.
- Últimas 5 semanas completas para evaluación; las anteriores para entrenamiento.
- Si quedan menos de 12 semanas completas o menos de 8 semanas con unidades positivas para la categoría, se devuelve `sin_historial_suficiente`.
- Modelo: regresión Ridge con `alpha` fijo y solver determinista.
- Línea base: repetir las unidades de la última semana observada. La media de las cuatro semanas previas se usa como variable del modelo, no como segunda métrica.
- Métrica principal: MAE sobre las semanas de evaluación.
- El modelo solo se presenta como predicción si su MAE es menor que el de la línea base. Si no la supera, se devuelve un resultado controlado que indique la limitación y muestre las métricas; no se inventa una precisión.

### 9.5 Salida

Predicción válida:

```json
{
  "tipo_resultado": "prediccion",
  "objetivo": "unidades_vendidas_por_categoria_semana",
  "unidad": "unidades",
  "categoria": "Bebidas",
  "periodo_objetivo": {
    "semana_inicio": "2026-06-29",
    "semana_fin": "2026-07-05",
    "semana_iso": "2026-W27"
  },
  "valores": {
    "unidades_estimadas": 14.2,
    "unidades_redondeadas": 14
  },
  "modelo": {
    "algoritmo": "Ridge",
    "variables": [
      "indice_semana",
      "mes",
      "unidades_semana_anterior",
      "promedio_4_semanas_previas",
      "unidades_misma_semana_mes_anterior"
    ],
    "semanas_entrenamiento": 20,
    "semanas_evaluacion": 5
  },
  "metricas": {
    "mae_modelo": 2.1,
    "mae_linea_base": 3.4,
    "supera_linea_base": true
  },
  "es_estimacion": true,
  "fuente_datos": "datos_simulados_de_demostracion",
  "advertencia": "Estimación semanal de unidades basada en ventas históricas. No garantiza la demanda futura."
}
```

Resultado sin historial suficiente:

```json
{
  "tipo_resultado": "sin_historial_suficiente",
  "objetivo": "unidades_vendidas_por_categoria_semana",
  "unidad": "unidades",
  "categoria": "Limpieza",
  "semanas_completas": 4,
  "semanas_con_unidades": 3,
  "minimo_semanas_completas": 12,
  "minimo_semanas_con_unidades": 8,
  "motivo": "No hay historial semanal suficiente para entrenar y evaluar el modelo.",
  "es_estimacion": true
}
```

Resultado cuando el modelo no supera la línea base:

```json
{
  "tipo_resultado": "modelo_no_supera_linea_base",
  "objetivo": "unidades_vendidas_por_categoria_semana",
  "unidad": "unidades",
  "categoria": "Botanas",
  "periodo_objetivo": {
    "semana_inicio": "2026-06-29",
    "semana_fin": "2026-07-05",
    "semana_iso": "2026-W27"
  },
  "metricas": {
    "mae_modelo": 4.8,
    "mae_linea_base": 3.9,
    "supera_linea_base": false
  },
  "motivo": "El modelo no superó la línea base en la evaluación cronológica.",
  "es_estimacion": true
}
```

La interfaz de la aplicación debe mostrar el periodo, la unidad, el carácter estimado y la advertencia. No debe presentar estos valores como una certeza ni como ventas reales.

## 10. Interfaz interna para Mia-Paola

Esta rama expone funciones y modelos, no rutas HTTP. El controlador decide la respuesta HTTP y la autorización.

Funciones propuestas:

```text
listar_ventas_cliente(session, propietario_id, desde=None, hasta=None, limite=100, desplazamiento=0, hoy=None) -> PaginaVentas
obtener_venta_cliente(session, propietario_id, venta_id, hoy=None) -> VentaLeida
estadisticas_cliente(session, propietario_id, desde=None, hasta=None, agrupacion="semana", hoy=None) -> EstadisticasCliente
estadisticas_clientes_admin(session, actor_admin_id, desde=None, hasta=None, agrupacion="semana", hoy=None) -> EstadisticasAdmin
listar_clientes_admin(session, actor_admin_id, limite=100, desplazamiento=0, solo_activos=True) -> PaginaClientes
promover_cliente_admin(session, actor_admin_id, cliente_id) -> Usuario
predecir_demanda_categoria(session, propietario_id, categoria, desde=None, hasta=None, hoy=None, minimo_semanas_completas=None, minimo_semanas_con_unidades=None, semanas_evaluacion=None) -> ResultadoPrediccion
predecir_todas_las_categorias(session, propietario_id, desde=None, hasta=None, hoy=None) -> list[ResultadoPrediccion]
```

`hoy` permite fijar la fecha de corte en pruebas; en produccion se usa la fecha actual. `predecir_demanda_categoria` devuelve un modelo `PrediccionDemanda`, `SinHistorialSuficiente` o `ModeloNoSuperaLineaBase`, no una excepcion.

Excepciones controladas:

| Excepción | Uso sugerido por el controlador |
| --- | --- |
| `NoEncontrado` | 404, sin revelar si el recurso pertenece a otro usuario |
| `RegistroInvalido` | 409 o 422 con mensaje controlado, sin trazas ni datos de otra persona |
| `HistorialInsuficiente` (modelo `SinHistorialSuficiente`) | 200 con `tipo_resultado: "sin_historial_suficiente"`; no es una excepción |
| `ModeloNoSuperaLineaBase` (modelo) | 200 con `tipo_resultado: "modelo_no_supera_linea_base"`; no es una excepción |
| `ConflictoImportacion` | 409 en la herramienta de carga, no en la API pública |
| `ErrorValidacionArchivo` | Error de carga con archivo, fila y campo |

Reglas para el controlador:

- `propietario_id` se obtiene de la sesión autenticada, nunca del cuerpo ni de la URL.
- Las funciones administrativas se llaman solo después de verificar el rol en la base de datos, no con un rol enviado por el cliente.
- La promoción no acepta `rol` como texto libre; la función solo permite `cliente -> administrador`.
- Las respuestas no incluyen `password_hash` ni secretos.

## 11. Decisiones resueltas

1. Stack confirmado: Python 3.12+, FastAPI, PostgreSQL 16+, SQLAlchemy 2, Alembic, psycopg 3, Pydantic 2, scikit-learn, pytest y Argon2id.
2. Nombres de tablas, columnas, funciones y modelos acordados con el equipo; Mia-Paola conserva rutas, controladores y autenticacion.
3. Un solo cliente de demostracion es propietario de los cinco conjuntos.
4. Las estadisticas administrativas incluyen agregados por cliente, por categoria y por semana o mes.
5. Umbrales confirmados: 12 semanas completas minimas, 8 con unidades positivas y 5 semanas de evaluacion.
6. `clave_idempotencia` queda disponible y opcional para ventas creadas por API; esta rama no expone esa ruta.
7. No se persiste historial de promociones en esta version.
8. Politica de contrasena e inicializacion del administrador confirmadas; el primer administrador se crea por CLI y nunca por registro publico.
9. El mapeo HTTP de las excepciones y la forma final de los DTO se resuelven en la rama de integracion.

## 12. Plan de pruebas

Se ejecutarán con PostgreSQL desechable, nunca contra la base de desarrollo ni producción.

- Migración desde una base vacía y verificación de tablas, claves, restricciones e índices.
- Carga válida de un archivo y registro de la importación como demostración.
- Segunda carga del mismo archivo sin duplicados.
- Rechazo transaccional por fecha inválida, cantidad no positiva, total inconsistente, producto desconocido, categoría desconocida y campos faltantes.
- Conflicto al reimportar el mismo conjunto con contenido distinto.
- Estadísticas que excluyen filas inválidas y reportan `registros_excluidos`.
- Consulta individual de una fila inválida con error controlado.
- Aislamiento de ventas y estadísticas entre dos propietarios.
- Entrenamiento cronológico sin fuga de datos.
- Comportamiento con conjunto vacío e historial insuficiente.
- Predicción estable para la misma entrada.
- Comparación del modelo contra la línea base y resultado controlado cuando no la supera.
- Verificación de hash Argon2id y ausencia de contraseñas en texto plano.

## 13. Fuera de alcance de esta rama

- Rutas HTTP y controladores.
- Autenticación, sesiones y tokens.
- Cambios en la aplicación móvil.
- IoT.
- Predicciones persistidas.
- Datos reales de una empresa o de un profesor.
