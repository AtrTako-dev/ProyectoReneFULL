package com.morestock.app.data

import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

class MoreStockApi(baseUrl: String) {
    private val baseUrl = baseUrl.trimEnd('/')

    suspend fun login(email: String, password: String): UserSession {
        val response = request(
            path = "auth/login",
            method = "POST",
            body = JSONObject()
                .put("email", email)
                .put("password", password),
        )
        val user = response.optJSONObject("usuario") ?: JSONObject()
        return UserSession(
            token = response.optString("token"),
            email = user.optString("email", email),
            businesses = response.optJSONArray("negocios").toBusinesses(),
        )
    }

    suspend fun logout(token: String) {
        request(path = "auth/logout", method = "POST", token = token)
    }

    suspend fun getBusinesses(token: String): List<Business> = request(
        path = "businesses",
        token = token,
    ).optJSONArray("negocios").toBusinesses()

    suspend fun getProducts(token: String, businessId: String): List<Product> {
        val response = request(path = "businesses/${pathSegment(businessId)}/products", token = token)
        return response.optJSONArray("productos").toProducts()
    }

    suspend fun getInventory(token: String, businessId: String): List<InventoryItem> {
        val response = request(path = "businesses/${pathSegment(businessId)}/inventory", token = token)
        return response.optJSONArray("inventario").toInventoryItems()
    }

    suspend fun updateInventory(
        token: String,
        businessId: String,
        productId: String,
        quantity: Double,
        unit: String,
        note: String? = null,
    ): InventoryItem = request(
        path = "businesses/${pathSegment(businessId)}/inventory/${pathSegment(productId)}",
        method = "PUT",
        token = token,
        body = JSONObject()
            .put("cantidad", quantity)
            .put("unidad", unit)
            .put("motivo", note),
    ).optJSONObject("inventario")?.toInventoryItem()
        ?: throw IllegalStateException("La respuesta no contiene el inventario actualizado.")

    suspend fun getRecommendations(token: String, businessId: String): List<Recommendation> {
        val response = request(path = "businesses/${pathSegment(businessId)}/recommendations", token = token)
        return response.optJSONArray("recomendaciones").toRecommendations()
    }

    suspend fun getForecast(token: String, businessId: String, productId: String): Forecast {
        val response = request(
            path = "businesses/${pathSegment(businessId)}/products/${pathSegment(productId)}/forecast",
            token = token,
        ).optJSONObject("pronostico") ?: JSONObject()
        val graph = response.optJSONObject("grafica") ?: JSONObject()
        val metrics = response.optJSONObject("metricas")?.let {
            ForecastMetrics(
                mae = it.opt("mae").toNullableDouble(),
                wapePercent = it.opt("wapePercent").toNullableDouble(),
                observations = it.optInt("observations").takeIf { value -> value > 0 },
            )
        }
        return Forecast(
            productName = response.optString("producto", "Producto"),
            unit = response.optString("unidad"),
            horizonWeeks = response.optInt("semanas", 1),
            predictedDemand = response.optDouble("demanda_pronosticada", 0.0),
            modelName = response.optString("modelo", "Modelo de demostración"),
            syntheticData = response.optBoolean("datos_sinteticos", false),
            source = response.optString("fuente_datos"),
            metrics = metrics,
            history = graph.optJSONArray("historico").toForecastPoints("fecha", "demanda"),
            weeklyPredictions = graph.optJSONArray("pronosticos_semanales").toForecastPoints("fecha_inicio", "demanda"),
        )
    }

    private suspend fun request(
        path: String,
        method: String = "GET",
        token: String? = null,
        body: JSONObject? = null,
    ): JSONObject = withContext(Dispatchers.IO) {
        val connection = (URL("$baseUrl/$path").openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
            if (token != null) setRequestProperty("Authorization", "Bearer $token")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }

        try {
            if (body != null) {
                connection.outputStream.use { output ->
                    output.write(body.toString().toByteArray(StandardCharsets.UTF_8))
                }
            }

            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val responseText = stream?.bufferedReader(StandardCharsets.UTF_8)?.use { it.readText() }.orEmpty()
            val response = if (responseText.isBlank()) JSONObject() else JSONObject(responseText)
            if (status !in 200..299) {
                val message = response.optJSONObject("error")?.optString("message")
                    ?.takeIf(String::isNotBlank)
                    ?: "La solicitud falló con código $status."
                throw MoreStockApiException(message, status)
            }
            response
        } finally {
            connection.disconnect()
        }
    }

    private fun pathSegment(value: String): String = URLEncoder
        .encode(value, StandardCharsets.UTF_8.name())
        .replace("+", "%20")
}

class MoreStockApiException(message: String, val statusCode: Int? = null) : Exception(message)

private fun JSONArray?.toBusinesses(): List<Business> = buildList {
    if (this@toBusinesses == null) return@buildList
    for (index in 0 until length()) {
        val item = optJSONObject(index) ?: continue
        add(
            Business(
                id = item.optString("id"),
                name = item.optString("name", "Negocio"),
                role = item.optString("role", "employee"),
            ),
        )
    }
}

private fun JSONArray?.toProducts(): List<Product> = buildList {
    if (this@toProducts == null) return@buildList
    for (index in 0 until length()) {
        val item = optJSONObject(index) ?: continue
        val inventory = item.opt("inventario_actual")
        add(
            Product(
                sku = item.optString("producto_id"),
                name = item.optString("producto", "Producto"),
                category = item.optString("categoria"),
                brand = item.optString("marca"),
                unit = item.optString("unidad"),
                inventoryQuantity = inventory.toNullableDouble(),
            ),
        )
    }
}

private fun JSONArray?.toInventoryItems(): List<InventoryItem> = buildList {
    if (this@toInventoryItems == null) return@buildList
    for (index in 0 until length()) {
        val item = optJSONObject(index) ?: continue
        add(item.toInventoryItem())
    }
}

private fun JSONObject.toInventoryItem(): InventoryItem = InventoryItem(
    sku = optString("producto_id"),
    productName = optString("producto", "Producto"),
    quantity = optDouble("cantidad", 0.0),
    unit = optString("unidad"),
    synthetic = optBoolean("sintetico", false),
    source = optString("fuente"),
)

private fun JSONArray?.toRecommendations(): List<Recommendation> = buildList {
    if (this@toRecommendations == null) return@buildList
    for (index in 0 until length()) {
        val item = optJSONObject(index) ?: continue
        val metadata = item.optJSONObject("metadatos") ?: JSONObject()
        val metrics = metadata.optJSONObject("metricas") ?: JSONObject()
        val selectedMetrics = metrics.optJSONObject("selected") ?: JSONObject()
        val details = item.optJSONObject("explicacion_detallada")
        add(
            Recommendation(
                sku = item.optString("producto_id"),
                productName = item.optString("producto", "Producto"),
                unit = item.optString("unidad"),
                currentStock = item.optDouble("inventario_actual", 0.0),
                forecastDemand = item.optDouble("demanda_pronosticada", 0.0),
                planningDemand = item.optDouble("demanda_para_planificacion", 0.0),
                suggestedQuantity = item.optDouble("cantidad_sugerida", 0.0),
                targetStock = item.optDouble("inventario_objetivo", 0.0),
                status = item.optString("recomendacion", "MANTENER"),
                explanation = details?.optString("resumen")
                    ?.takeIf(String::isNotBlank)
                    ?: item.optString("explicacion"),
                modelName = metadata.optString("modelo", "Modelo de demostración"),
                mae = selectedMetrics.opt("mae").toNullableDouble(),
                wapePercent = selectedMetrics.opt("wapePercent").toNullableDouble(),
                syntheticForecast = metadata.optBoolean("datos_pronostico_sinteticos", false),
            ),
        )
    }
}

private fun JSONArray?.toForecastPoints(dateKey: String, demandKey: String): List<ForecastPoint> = buildList {
    if (this@toForecastPoints == null) return@buildList
    for (index in 0 until length()) {
        val item = optJSONObject(index) ?: continue
        add(ForecastPoint(item.optString(dateKey), item.optDouble(demandKey, 0.0)))
    }
}

private fun Any?.toNullableDouble(): Double? = when (this) {
    null, JSONObject.NULL -> null
    is Number -> toDouble()
    is String -> toDoubleOrNull()
    else -> null
}
