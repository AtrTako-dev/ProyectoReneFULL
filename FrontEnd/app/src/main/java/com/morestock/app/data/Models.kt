package com.morestock.app.data

data class Business(
    val id: String,
    val name: String,
    val role: String,
)

data class Product(
    val sku: String,
    val name: String,
    val category: String,
    val brand: String,
    val unit: String,
    val inventoryQuantity: Double?,
)

data class InventoryItem(
    val sku: String,
    val productName: String,
    val quantity: Double,
    val unit: String,
    val synthetic: Boolean,
    val source: String,
)

data class Recommendation(
    val sku: String,
    val productName: String,
    val unit: String,
    val currentStock: Double,
    val forecastDemand: Double,
    val planningDemand: Double,
    val suggestedQuantity: Double,
    val targetStock: Double,
    val status: String,
    val explanation: String,
    val modelName: String,
    val mae: Double?,
    val wapePercent: Double?,
    val syntheticForecast: Boolean,
)

data class Forecast(
    val productName: String,
    val unit: String,
    val horizonWeeks: Int,
    val predictedDemand: Double,
    val modelName: String,
    val syntheticData: Boolean,
    val source: String,
    val metrics: ForecastMetrics?,
    val history: List<ForecastPoint>,
    val weeklyPredictions: List<ForecastPoint>,
)

data class ForecastMetrics(
    val mae: Double?,
    val wapePercent: Double?,
    val observations: Int?,
)

data class ForecastPoint(
    val date: String,
    val demand: Double,
)

data class UserSession(
    val token: String,
    val email: String,
    val businesses: List<Business>,
)
