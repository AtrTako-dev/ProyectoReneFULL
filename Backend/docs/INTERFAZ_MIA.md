# Interfaz para la API de Mia-Paola

Este documento fija el contrato entre la persistencia/carga/modelo de Ismael y
la API Express de Mia-Paola. **No se implementan rutas ni autenticación aquí.**

## 1. Cambios de tipos que debe adoptar la API

La API actual convierte códigos de texto a número. Eso pierde información
(`B003` no es un número) y hace que el cargador descarte o deforme filas. La
API debe conservar estos tipos:

| Dato | Tipo correcto | Ejemplo |
|---|---|---|
| `productos.producto_id` | texto | `B003` |
| `ventas.producto_id` | texto | `B003` |
| `ventas.id_venta` | entero interno autoincremental | `1` |
| `ventas.id_origen` | texto de la fuente | `D01-066` |
| `usuarios.id` | entero | `4` |
| `precio_unitario_mxn` | decimal; en JSON, número | `31.00` |
| `total_mxn` | decimal; en JSON, número | `124.00` |

Cambios concretos recomendados en el código de la API:

1. `src/validaciones/ventas.js`: `producto_id` debe validarse como texto con
   patrón `^[A-Z]{1,3}[0-9]{3}$`, no con `enteroPositivo`.
2. `src/controladores/ventaControlador.js`: no usar
   `Number(producto.producto_id)` al insertar.
3. `src/servicios/registros.js`: no convertir `id_venta` ni `producto_id` a
   número. `id_venta` de la base es el ID interno; `id_origen` es el código de
   la fuente.
4. `src/servicios/serializadores.js`: devolver `producto_id` como texto y
   agregar `id_origen` si la respuesta lo necesita.
5. `src/modelos/ventaModelo.js`: las columnas actuales siguen existiendo; se
   agregan `importacion_id` e `id_origen`. Las ventas manuales insertadas por la
   API pueden dejarlos en `NULL`.
6. `scripts/cargarDemo.js` actual: reemplazarlo por
   `src/datos/importador.js` o ejecutar el comando de este paquete. El cargador
   actual omite filas por la conversión numérica.

## 2. Columnas compartidas

La migración crea estas columnas, compatibles con los nombres actuales de la
API:

```text
usuarios(id, nombre, email, password_hash, rol, activo, creado_en, actualizado_en)

productos(producto_id, producto, categoria, precio_unitario_mxn, activo,
          creado_en, actualizado_en)

ventas(id_venta, importacion_id, id_origen, usuario_id, fecha, producto_id,
       producto, categoria, precio_unitario_mxn, cantidad, total_mxn, creado_en)

importaciones(id, conjunto, archivo, hash_sha256, perfil_demanda, fuente,
              es_demostracion, moneda, periodo_inicio, periodo_fin,
              cantidad_registros, propietario_id, importado_por, importado_en)
```

No se renombran las columnas que ya usa la API (`precio_unitario_mxn`,
`total_mxn`, `cantidad`, `fecha`, etc.).

## 3. Funciones de consulta

Todas están en `src/datos/consultas.js` y usan el pool de `src/db/mysql.js`.

### 3.1 `listarVentasValidas(usuarioId, opciones)`

```js
const { ventas, excluidas } = await listarVentasValidas(req.usuarioId, {
  desde,
  hasta,
  limite,
});
```

- `usuarioId` obligatorio; `null` solo para la consulta administrativa interna.
- Filtra por propietario y fechas.
- Valida cada fila contra el catálogo.
- `ventas` solo contiene filas válidas.
- `excluidas` contiene `{ id_venta, problemas }`.

### 3.2 `obtenerVentaValida(usuarioId, idVenta)`

- Devuelve la venta si pertenece al usuario y es válida.
- Lanza `NO_ENCONTRADO` si no existe.
- Lanza `REGISTRO_INVALIDO` si existe pero no pasa la validación.

### 3.3 `estadisticasCliente(usuarioId, opciones)`

Respuesta compatible con la ruta actual:

```json
{
  "periodo": { "desde": "2026-01-01", "hasta": "2026-06-29" },
  "total_ventas": 500,
  "total_unidades": 1287,
  "total_importe_mxn": 36404,
  "por_categoria": [
    { "categoria": "Abarrotes", "ventas": 93, "unidades": 236, "importe_mxn": 6113.5 }
  ],
  "por_periodo": [
    {
      "etiqueta": "2026-W02",
      "periodo_inicio": "2026-01-05",
      "periodo_fin": "2026-01-11",
      "ventas": 25,
      "unidades": 47,
      "importe_mxn": 1362.5
    }
  ],
  "registros_excluidos": 0
}
```

### 3.4 `estadisticasAdmin(opciones)`

```json
{
  "periodo": { "desde": "2026-01-01", "hasta": "2026-06-29" },
  "agrupacion": "semana",
  "grupos": [
    { "etiqueta": "2026-W02", "periodo_inicio": "2026-01-05", "periodo_fin": "2026-01-11", "ventas": 25, "unidades": 47, "importe_mxn": 1362.5 }
  ],
  "totales": { "ventas": 500, "unidades": 1287, "importe_mxn": 36404 },
  "por_categoria": [],
  "registros_excluidos": 0
}
```

### 3.5 `cargarVentasParaModelo({ usuarioId, desde, hasta, limite })`

Devuelve `{ ventas, excluidas }`; las ventas incluyen `es_demostracion` para
que el resultado del modelo pueda declarar su fuente. No se debe llamar al
modelo con filas sin validar.

## 4. Modelo de demanda

Llamada recomendada desde la ruta:

```js
const { ventas } = await cargarVentasParaModelo({ usuarioId: req.usuarioId });
return res.json(predecirDemanda(ventas, { horizonte: 7 }));
```

La salida es semanal. Ejemplo de una categoría con resultado `ok`:

```json
{
  "tipo": "estimacion",
  "estado": "ok",
  "categoria": "Abarrotes",
  "unidad": "unidades",
  "periodicidad": "semanal",
  "periodo": { "desde": "2026-07-06", "hasta": "2026-07-12" },
  "valores": [
    {
      "fecha": "2026-07-06",
      "semana_inicio": "2026-07-06",
      "semana_fin": "2026-07-12",
      "etiqueta": "2026-07-06 / 2026-07-12",
      "cantidad_estimada": 9.13
    }
  ],
  "modelo": {
    "algoritmo": "Ridge",
    "alpha": 1,
    "variables": [
      "indice_semana",
      "mes",
      "unidades_semana_anterior",
      "promedio_4_semanas_previas",
      "unidades_misma_semana_mes_anterior"
    ],
    "semanas_entrenamiento": 21,
    "semanas_evaluacion": 5
  },
  "evaluacion": {
    "metodo": "MAE",
    "corte": "cronologico",
    "mae_modelo": 2.85,
    "mae_linea_base": 5.6,
    "mejora_mae_porcentaje": 49.11,
    "supera_linea_base": true,
    "linea_base": "unidades de la semana anterior"
  },
  "datos": {
    "fuente": "datos_simulados_de_demostracion",
    "filas_utilizadas": 100,
    "semanas_disponibles": 25,
    "semanas_con_unidades": 25
  },
  "por_categoria": [],
  "resumen_categorias": { "ok": 4, "sin_base_suficiente": 0, "modelo_no_supera_linea_base": 2 },
  "advertencia": "Estimación semanal de unidades basada en ventas históricas. No garantiza la demanda futura."
}
```

Los valores numéricos de `mae_modelo` y `mae_linea_base` del ejemplo son los
obtenidos con los datos simulados de demostración; no son una promesa de
precisión.

Estados posibles:

| Estado | `valores` | Acción de la API |
|---|---|---|
| `ok` | Semanas estimadas | Devolver 200 con la estimación y la advertencia |
| `sin_base_suficiente` | `[]` | Devolver 200 controlado o 422, según el contrato de UI |
| `modelo_no_supera_linea_base` | `[]` | Devolver 200 controlado; no mostrar una cifra inventada |

El estado `modelo_no_supera_linea_base` es una extensión del contrato actual.
La app móvil debe aceptarlo; si todavía no lo hace, la API puede mapearlo a
`sin_base_suficiente` para no romper la versión anterior, pero debe conservar
el mensaje y no fabricar valores.

## 5. Orden de integración

1. Aplicar `npm run db:migrar`.
2. Crear la cuenta demo con `npm run demo:cuenta`.
3. Cargar los cinco JSON con `npm run demo:cargar`.
4. Ajustar la API para conservar `producto_id` como texto y usar `id_origen`
   para el código de la fuente.
5. Reemplazar las consultas que leen la tabla `ventas` por
   `listarVentasValidas`/`cargarVentasParaModelo`, o aplicar la misma validación
   de filas antes de estadísticas y predicción.
6. Cambiar la ruta de predicción a la salida semanal y manejar los tres estados.
