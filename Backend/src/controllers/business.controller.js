import { HttpError } from '../utils/http-error.js';

function userIdFrom(request) {
  return request.auth.user?.id ?? request.auth.user?.user_id;
}

function dateToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseHorizon(value) {
  const horizon = value === undefined ? 1 : Number(value);
  if (!Number.isSafeInteger(horizon) || horizon < 1 || horizon > 12) {
    throw new HttpError(400, 'INVALID_HORIZON', 'El horizonte debe ser un número entero entre 1 y 12 semanas.');
  }
  return horizon;
}

function assertDatasetBusiness(salesRepository, businessId) {
  const business = salesRepository.getBusiness(businessId);
  if (!business) {
    throw new HttpError(404, 'SALES_DATA_NOT_FOUND', 'Este negocio no tiene datos de ventas de demostración.');
  }
  return business;
}

function assertProduct(salesRepository, businessId, productId) {
  assertDatasetBusiness(salesRepository, businessId);
  const product = salesRepository.getProduct(businessId, productId);
  if (!product) {
    throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'No se encontró el producto en el surtido del negocio.');
  }
  return product;
}

function toRecommendationPayload({
  forecast,
  inventory,
  recommendation,
  explanation,
  explanationDetails,
  events,
}) {
  const recommendationLabels = {
    BUY: 'COMPRAR',
    HOLD: 'MANTENER',
    NO_BUY: 'NO_COMPRAR',
  };
  return {
    negocio_id: forecast.businessId,
    producto_id: forecast.productId,
    producto: forecast.productName,
    unidad: forecast.unit,
    inventario_actual: inventory.quantity,
    demanda_pronosticada: forecast.predictedDemand,
    demanda_para_planificacion: recommendation.planningDemand,
    semanas_pronosticadas: forecast.horizonWeeks,
    recomendacion: recommendationLabels[recommendation.status],
    cantidad_sugerida: recommendation.suggestedReplenishment,
    inventario_seguridad: recommendation.safetyStock,
    inventario_objetivo: recommendation.targetStock,
    explicacion: explanation,
    explicacion_detallada: explanationDetails,
    politica: recommendation.policy,
    eventos_calendario: events,
    metadatos: {
      inventario_sintetico: inventory.isSynthetic,
      fuente_inventario: inventory.sourceLabel,
      modelo: forecast.modelName,
      metricas: forecast.metrics,
      datos_pronostico_sinteticos: forecast.syntheticData,
      fuente_pronostico: forecast.sourceOrigin,
    },
  };
}

export function createBusinessController({
  authService,
  salesRepository,
  forecastService,
  inventoryService,
  recommendationService,
  explanationService,
  calendarService,
}) {
  const getForecast = (businessId, productId, horizonWeeks = 1) => {
    assertProduct(salesRepository, businessId, productId);
    return forecastService.forecast({ businessId, productId, horizonWeeks });
  };

  const makeRecommendation = async (businessId, productId) => {
    const forecast = getForecast(businessId, productId, 1);
    const inventory = await inventoryService.get(businessId, productId);
    const calendarDate = dateToday();
    const product = salesRepository.getProduct(businessId, productId);
    const calendarMetadata = calendarService.metadataForDate(calendarDate);
    const events = calendarService.eventsForDate(calendarDate, product.category);
    const recommendation = recommendationService.recommend({ forecast, inventory });
    const explanationInput = { forecast, inventory, recommendation, events, calendarMetadata };
    const explanation = explanationService.explain(explanationInput);
    const details = explanationService.explainDetails(explanationInput);
    return toRecommendationPayload({
      forecast,
      inventory,
      recommendation,
      explanation,
      explanationDetails: details,
      events,
    });
  };

  return {
    listBusinesses: async (request, response) => {
      response.json({ negocios: await authService.getBusinessesForUser(userIdFrom(request)) });
    },

    createBusiness: async (request, response) => {
      const name = request.body?.nombre ?? request.body?.name;
      const negocio = await authService.createBusiness(userIdFrom(request), { name });
      response.status(201).json({ negocio });
    },

    listMembers: async (request, response) => {
      const members = await authService.listMembers(userIdFrom(request), request.params.businessId);
      response.json({ miembros: members });
    },

    addMember: async (request, response) => {
      const member = await authService.addMember(
        userIdFrom(request),
        request.params.businessId,
        {
          email: request.body?.correo ?? request.body?.email,
          role: request.body?.rol ?? request.body?.role ?? 'employee',
        },
      );
      response.status(201).json({ miembro: member });
    },

    listProducts: async (request, response) => {
      const { businessId } = request.params;
      const business = salesRepository.getBusiness(businessId);
      if (!business) {
        return response.json({ negocio_id: businessId, productos: [], fuente: 'sin datos de demostración' });
      }

      const products = salesRepository.getProducts(businessId);
      const stocks = await inventoryService.list(businessId, products);
      const stockById = new Map(stocks.map(item => [String(item.productId), item]));
      response.json({
        negocio_id: business.businessId,
        negocio: business.businessName,
        productos: products.map(product => ({
          producto_id: product.productId,
          producto: product.productName,
          categoria: product.category,
          marca: product.brand,
          unidad: product.unit,
          inventario_actual: stockById.get(String(product.productId))?.quantity ?? null,
        })),
      });
    },

    listSales: async (request, response) => {
      const { businessId } = request.params;
      assertDatasetBusiness(salesRepository, businessId);
      const productId = request.query.producto_id ?? request.query.productId;
      if (productId) assertProduct(salesRepository, businessId, productId);

      const parsedLimit = request.query.limite === undefined ? 100 : Number(request.query.limite);
      if (!Number.isSafeInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
        throw new HttpError(400, 'INVALID_LIMIT', 'El límite debe ser un entero entre 1 y 1000.');
      }
      const sales = salesRepository.getSales(businessId, productId).slice(0, parsedLimit);
      response.json({
        negocio_id: businessId,
        ventas: sales.map(sale => ({
          producto_id: sale.productId,
          semana: sale.weekNumber,
          fecha_inicio: sale.startDate,
          fecha_fin: sale.endDate,
          unidades_vendidas: sale.unitsSold,
        })),
        fuente: 'datos sintéticos de demostración',
      });
    },

    getInventory: async (request, response) => {
      const { businessId } = request.params;
      assertDatasetBusiness(salesRepository, businessId);
      const items = await inventoryService.list(businessId, salesRepository.getProducts(businessId));
      response.json({
        negocio_id: businessId,
        inventario: items.map(item => ({
          producto_id: item.productId,
          producto: item.product.name,
          cantidad: item.quantity,
          unidad: item.unit,
          sintetico: item.isSynthetic,
          fuente: item.sourceLabel,
        })),
      });
    },

    getInventoryMovements: async (request, response) => {
      const { businessId, productId } = request.params;
      assertProduct(salesRepository, businessId, productId);
      const limit = request.query.limite === undefined ? 100 : Number(request.query.limite);
      const movements = await inventoryService.getMovements(businessId, productId, limit);
      response.json({
        negocio_id: businessId,
        producto_id: productId,
        movimientos: movements.map(movement => ({
          id: movement.id,
          tipo: movement.type,
          cambio: movement.quantityDelta,
          unidad: movement.unit,
          nota: movement.note,
          usuario: movement.userId ? { id: movement.userId, correo: movement.userEmail } : null,
          fecha: movement.createdAt,
        })),
      });
    },

    recordInventoryMovement: async (request, response) => {
      const { businessId, productId } = request.params;
      const product = assertProduct(salesRepository, businessId, productId);
      const result = await inventoryService.createMovement(businessId, productId, {
        type: request.body?.tipo ?? request.body?.type,
        quantity: request.body?.cantidad ?? request.body?.quantity,
        unit: request.body?.unidad ?? request.body?.unit,
        note: request.body?.nota ?? request.body?.note,
        userId: userIdFrom(request),
      });
      response.status(201).json({
        inventario: {
          negocio_id: businessId,
          producto_id: productId,
          producto: product.productName,
          cantidad: result.inventory.quantity,
          unidad: result.inventory.unit,
          sintetico: result.inventory.isSynthetic,
          fuente: result.inventory.sourceLabel,
        },
        movimiento: {
          id: result.movement.id,
          tipo: result.movement.type,
          cambio: result.movement.quantityDelta,
          unidad: result.movement.unit,
          nota: result.movement.note,
          usuario: result.movement.userId ? { id: result.movement.userId, correo: request.auth.user.email } : null,
          fecha: result.movement.createdAt,
        },
      });
    },

    updateInventory: async (request, response) => {
      const { businessId, productId } = request.params;
      const product = assertProduct(salesRepository, businessId, productId);
      const quantity = request.body?.cantidad ?? request.body?.quantity;
      const unit = request.body?.unidad ?? request.body?.unit;
      const inventory = await inventoryService.update(businessId, productId, {
        quantity,
        unit,
        note: request.body?.motivo ?? request.body?.note,
        userId: userIdFrom(request),
      });
      response.json({
        inventario: {
          negocio_id: businessId,
          producto_id: productId,
          producto: product.productName,
          cantidad: inventory.quantity,
          unidad: inventory.unit,
          sintetico: inventory.isSynthetic,
          fuente: inventory.sourceLabel,
        },
      });
    },

    getForecast: async (request, response) => {
      const horizonWeeks = parseHorizon(request.query.semanas ?? request.query.horizonWeeks);
      const forecast = getForecast(request.params.businessId, request.params.productId, horizonWeeks);
      response.json({
        pronostico: {
          negocio_id: forecast.businessId,
          producto_id: forecast.productId,
          producto: forecast.productName,
          unidad: forecast.unit,
          semanas: forecast.horizonWeeks,
          demanda_pronosticada: forecast.predictedDemand,
          modelo: forecast.modelName,
          datos_sinteticos: forecast.syntheticData,
          fuente_datos: forecast.sourceOrigin,
          metricas: forecast.metrics,
          grafica: {
            historico: forecast.historyPoints,
            ultima_semana: forecast.lastWeek,
            pronosticos_semanales: forecast.weeklyPredictions,
            demanda_pronosticada: forecast.predictedDemand,
          },
        },
      });
    },

    getRecommendation: async (request, response) => {
      response.json({ recomendacion: await makeRecommendation(request.params.businessId, request.params.productId) });
    },

    getExplanation: async (request, response) => {
      const recommendation = await makeRecommendation(request.params.businessId, request.params.productId);
      response.json({
        negocio_id: recommendation.negocio_id,
        producto_id: recommendation.producto_id,
        explicacion: recommendation.explicacion_detallada,
      });
    },

    listRecommendations: async (request, response) => {
      const { businessId } = request.params;
      assertDatasetBusiness(salesRepository, businessId);
      const recommendations = await Promise.all(salesRepository.getProducts(businessId).map(async product => {
        try {
          return await makeRecommendation(businessId, product.productId);
        } catch (error) {
          if (error.code === 'INSUFFICIENT_SALES_HISTORY') return null;
          throw error;
        }
      }));
      const items = recommendations.filter(Boolean);
      response.json({ negocio_id: businessId, recomendaciones: items });
    },

    listCalendarEvents: async (request, response) => {
      const fecha = request.query.fecha ?? dateToday();
      const categoria = request.query.categoria;
      const calendario = calendarService.metadataForDate(fecha);
      const eventos = calendarService.eventsForDate(fecha, categoria);
      response.json({
        fecha,
        calendario,
        eventos,
        nota: calendario.eventsWithoutDate.length > 0
          ? `No hay fechas configuradas para ${calendario.eventsWithoutDate.map(event => event.label).join(', ')} en ${calendario.year}; no se estiman ni se inventan. Los eventos disponibles son metadatos y no se usan para atribuir cambios de demanda.`
          : 'Los eventos son metadatos de calendario; no se usan para atribuir cambios de demanda.',
      });
    },

    getModelEvaluation: async (request, response) => {
      assertDatasetBusiness(salesRepository, request.params.businessId);
      const evaluation = forecastService.getEvaluation();
      const series = evaluation.perSeries.filter(item => String(item.businessId) === request.params.businessId);
      response.json({
        negocio_id: request.params.businessId,
        modelo: evaluation.modelName,
        protocolo: evaluation.protocol,
        fuente_datos: evaluation.sourceOrigin,
        datos_sinteticos: evaluation.syntheticData,
        observaciones_entrenamiento: evaluation.trainingObservations,
        observaciones_validacion: evaluation.validationObservations,
        observaciones_prueba: evaluation.testObservations,
        metricas_por_unidad: evaluation.metricsByUnit,
        metricas_por_negocio_y_unidad: evaluation.metricsByBusinessAndUnit.filter(
          item => String(item.businessId) === request.params.businessId,
        ),
        series: series.map(item => ({
          producto_id: item.productId,
          unidad: item.unit,
          estado: item.status,
          observaciones_historicas: item.historyObservations,
          observaciones_entrenamiento: item.trainingObservations,
          observaciones_validacion: item.validationObservations,
          observaciones_prueba: item.testObservations,
          prueba_muestra_pequena: item.testSampleIsSmall,
          metodo_seleccionado: item.selectedMethod ?? null,
          metricas: item.selected ?? null,
          metricas_validacion: item.validationMetrics ?? null,
          metricas_prueba: item.testMetrics ?? null,
          random_forest: item.randomForest ?? null,
          linea_base_ultima_semana: item.lastWeek ?? null,
          linea_base_promedio_4_semanas: item.movingAverage4 ?? null,
        })),
      });
    },

    getDashboard: async (request, response) => {
      const { businessId } = request.params;
      assertDatasetBusiness(salesRepository, businessId);
      const products = salesRepository.getProducts(businessId);
      const recommendations = await Promise.all(
        products.map(product => makeRecommendation(businessId, product.productId)),
      );
      const summary = {
        productos: products.length,
        comprar: recommendations.filter(item => item.recomendacion === 'COMPRAR').length,
        mantener: recommendations.filter(item => item.recomendacion === 'MANTENER').length,
        no_comprar: recommendations.filter(item => item.recomendacion === 'NO_COMPRAR').length,
      };
      response.json({
        negocio_id: businessId,
        resumen: summary,
        recomendaciones_prioritarias: recommendations
          .filter(item => item.recomendacion === 'COMPRAR')
          .sort((first, second) => second.cantidad_sugerida - first.cantidad_sugerida)
          .slice(0, 5),
      });
    },
  };
}
