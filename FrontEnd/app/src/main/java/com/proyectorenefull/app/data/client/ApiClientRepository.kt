package com.proyectorenefull.app.data.client

import com.proyectorenefull.app.data.remote.ApiCallResult
import com.proyectorenefull.app.data.remote.ApiErrorMapper
import com.proyectorenefull.app.data.remote.ClienteApi
import com.proyectorenefull.app.model.client.ClientInsights
import com.proyectorenefull.app.model.client.ClientRepository
import com.proyectorenefull.app.model.client.ClientResult
import com.proyectorenefull.app.model.client.PeriodStatistic
import com.proyectorenefull.app.model.client.PredictionValue
import com.proyectorenefull.app.model.client.SaleDraft
import com.proyectorenefull.app.model.client.SaleRecord
import com.proyectorenefull.app.model.client.StatisticValue
import org.json.JSONArray
import org.json.JSONObject
import java.math.BigDecimal
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class ApiClientRepository(private val api: ClienteApi) : ClientRepository {
    override fun createSale(sale: SaleDraft, onResult: (ClientResult<Unit>) -> Unit) {
        val body = JSONObject()
            .put("fecha", sale.dateMillis.toApiDate())
            .put("producto_id", sale.productId.trim().uppercase(Locale.ROOT))
            .put("cantidad", sale.quantity)
            .put("precio_unitario_mxn", sale.unitPriceMxn.toPlainString())
            .put("clave_idempotencia", sale.idempotencyKey)
        api.request("POST", "/api/ventas", body) { result ->
            val response = result as? ApiCallResult.Response
            if (response?.status == 200 || response?.status == 201) {
                onResult(ClientResult.Success(Unit))
            } else {
                onResult(ApiErrorMapper.clientFailure(result))
            }
        }
    }

    override fun ownSales(onResult: (ClientResult<List<SaleRecord>>) -> Unit) {
        api.request("GET", "/api/ventas/mias?limite=$SALES_PAGE_SIZE&desplazamiento=0") { firstPage ->
            val response = firstPage as? ApiCallResult.Response
            if (response?.status != 200) {
                onResult(ApiErrorMapper.clientFailure(firstPage))
                return@request
            }
            val total = response.body?.optInt("total", -1) ?: -1
            if (total < 0) {
                onResult(ClientResult.Failure("La respuesta de ventas no tiene el formato esperado."))
                return@request
            }

            val latestPageOffset = (total - SALES_PAGE_SIZE).coerceAtLeast(0)
            if (latestPageOffset == 0) {
                onResult(firstPage.toSalesResult())
            } else {
                api.request(
                    "GET",
                    "/api/ventas/mias?limite=$SALES_PAGE_SIZE&desplazamiento=$latestPageOffset"
                ) { latestPage ->
                    onResult(latestPage.toSalesResult())
                }
            }
        }
    }

    override fun ownInsights(onResult: (ClientResult<ClientInsights>) -> Unit) {
        var statisticsResult: ApiCallResult? = null
        var predictionsResult: ApiCallResult? = null

        fun finishIfReady() {
            val statisticsCall = statisticsResult ?: return
            val predictionsCall = predictionsResult ?: return
            val statisticsResponse = statisticsCall as? ApiCallResult.Response
            val predictionsResponse = predictionsCall as? ApiCallResult.Response
            if (statisticsResponse?.status != 200) {
                onResult(ApiErrorMapper.clientFailure(statisticsCall))
                return
            }
            if (predictionsResponse?.status != 200) {
                onResult(ApiErrorMapper.clientFailure(predictionsCall))
                return
            }
            val statistics = statisticsResponse.body
            val predictions = predictionsResponse.body?.optJSONArray("predicciones")
            if (statistics == null || predictions == null) {
                onResult(ClientResult.Failure("La respuesta de estadísticas no tiene el formato esperado."))
                return
            }
            runCatching { statistics.toClientInsights(predictions) }
                .onSuccess { onResult(ClientResult.Success(it)) }
                .onFailure { onResult(ClientResult.Failure("No se pudieron leer los resultados recibidos.")) }
        }

        api.request("GET", "/api/ventas/mias/estadisticas?agrupacion=semana") { result ->
            statisticsResult = result
            finishIfReady()
        }
        api.request("GET", "/api/ventas/mias/predicciones") { result ->
            predictionsResult = result
            finishIfReady()
        }
    }

    private fun JSONArray.toSaleRecords(): List<SaleRecord> = List(length()) { index ->
        val item = getJSONObject(index)
        SaleRecord(
            id = item.getLong("id"),
            productId = item.getString("producto_id"),
            product = item.getString("producto"),
            category = item.getString("categoria"),
            quantity = item.getInt("cantidad"),
            unitPriceMxn = item.getDecimal("precio_unitario_mxn"),
            totalMxn = item.getDecimal("total_mxn"),
            dateMillis = item.getString("fecha").toDateMillis()
        )
    }

    private fun JSONObject.toClientInsights(predictions: JSONArray): ClientInsights {
        val summaryObject = getJSONObject("resumen")
        val summary = listOf(
            StatisticValue("Transacciones válidas", summaryObject.getInt("transacciones_validas").toString()),
            StatisticValue("Unidades vendidas", summaryObject.getInt("unidades").toString()),
            StatisticValue("Importe total", "${summaryObject.getDecimal("importe_mxn").toPlainString()} MXN"),
            StatisticValue("Registros excluidos", summaryObject.getInt("registros_excluidos").toString())
        )
        val period = getJSONObject("periodo")
        val rowsKey = if (period.optString("agrupacion") == "mes") "por_mes" else "por_semana"
        val rows = optJSONArray(rowsKey) ?: JSONArray()
        val periods = List(rows.length()) { index ->
            val row = rows.getJSONObject(index)
            PeriodStatistic(
                label = row.getString("etiqueta"),
                category = row.getString("categoria"),
                transactions = row.getInt("transacciones"),
                units = row.getInt("unidades"),
                amountMxn = row.getDecimal("importe_mxn")
            )
        }
        val predictionValues = List(predictions.length()) { index ->
            predictions.getJSONObject(index).toPredictionValue()
        }
        return ClientInsights(
            summary = summary,
            periods = periods,
            predictions = predictionValues,
            hasSales = summaryObject.optInt("transacciones_validas") > 0
        )
    }

    private fun JSONObject.toPredictionValue(): PredictionValue {
        val category = optString("categoria", "Categoría")
        val target = optJSONObject("periodo_objetivo")
        val period = target?.let {
            it.optString("semana_iso").takeIf(String::isNotBlank)
                ?: "${it.optString("semana_inicio")} – ${it.optString("semana_fin")}"
        }.orEmpty()
        return when (optString("tipo_resultado")) {
            "prediccion" -> {
                val estimated = getJSONObject("valores").get("unidades_redondeadas").toString()
                PredictionValue.Estimate(
                    category = category,
                    value = estimated,
                    unit = optString("unidad", "unidades"),
                    period = period,
                    warning = optString("advertencia", "Estimación de la API; no garantiza la demanda futura.")
                )
            }
            "sin_historial_suficiente" -> PredictionValue.InsufficientData(
                category = category,
                period = period,
                reason = optString("motivo", "No hay suficientes datos para estimar.")
            )
            else -> PredictionValue.NoReliableEstimate(
                category = category,
                period = period,
                reason = optString("motivo", "La API no publicó una estimación fiable.")
            )
        }
    }

    private fun ApiCallResult.toSalesResult(): ClientResult<List<SaleRecord>> {
        val response = this as? ApiCallResult.Response
        if (response?.status != 200) return ApiErrorMapper.clientFailure(this)
        val items = response.body?.optJSONArray("items")
            ?: return ClientResult.Failure("La respuesta de ventas no tiene el formato esperado.")
        return runCatching { items.toSaleRecords().asReversed() }
            .fold(
                onSuccess = { ClientResult.Success(it) },
                onFailure = { ClientResult.Failure("No se pudieron leer las ventas recibidas.") }
            )
    }

    private fun JSONObject.getDecimal(key: String): BigDecimal = BigDecimal(get(key).toString())

    private fun Long.toApiDate(): String = SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }.format(Date(this))

    private fun String.toDateMillis(): Long = SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).apply {
        timeZone = TimeZone.getTimeZone("UTC")
        isLenient = false
    }.parse(this)?.time ?: throw IllegalArgumentException("Fecha de venta inválida")

    companion object {
        private const val SALES_PAGE_SIZE = 500
    }
}
