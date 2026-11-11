package com.proyectorenefull.app.domain.client

import java.math.BigDecimal

data class SaleDraft(
    val product: String,
    val category: String,
    val unitPriceMxn: BigDecimal,
    val quantity: Int,
    val dateMillis: Long
)

data class SaleRecord(
    val product: String,
    val category: String,
    val quantity: Int,
    val totalMxn: BigDecimal,
    val dateMillis: Long
)

data class StatisticValue(val label: String, val value: String)

sealed interface PredictionValue {
    data class Estimate(val value: String, val unit: String, val period: String) : PredictionValue
    data object InsufficientData : PredictionValue
}

data class ClientInsights(
    val statistics: List<StatisticValue>,
    val prediction: PredictionValue
)

sealed interface ClientResult<out T> {
    data class Success<T>(val value: T) : ClientResult<T>
    data object Unavailable : ClientResult<Nothing>
    data class Failure(val message: String) : ClientResult<Nothing>
}
