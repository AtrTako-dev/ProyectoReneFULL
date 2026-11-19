package com.proyectorenefull.app.model.client

import java.math.BigDecimal

data class SaleDraft(
    val productId: String,
    val unitPriceMxn: BigDecimal,
    val quantity: Int,
    val dateMillis: Long,
    val idempotencyKey: String
)

data class SaleRecord(
    val id: Long,
    val productId: String,
    val product: String,
    val category: String,
    val quantity: Int,
    val unitPriceMxn: BigDecimal,
    val totalMxn: BigDecimal,
    val dateMillis: Long
)

data class StatisticValue(val label: String, val value: String)

data class PeriodStatistic(
    val label: String,
    val category: String,
    val transactions: Int,
    val units: Int,
    val amountMxn: BigDecimal
)

sealed interface PredictionValue {
    val category: String
    val period: String

    data class Estimate(
        override val category: String,
        val value: String,
        val unit: String,
        override val period: String,
        val warning: String
    ) : PredictionValue

    data class InsufficientData(
        override val category: String,
        override val period: String,
        val reason: String
    ) : PredictionValue

    data class NoReliableEstimate(
        override val category: String,
        override val period: String,
        val reason: String
    ) : PredictionValue
}

data class ClientInsights(
    val summary: List<StatisticValue>,
    val periods: List<PeriodStatistic>,
    val predictions: List<PredictionValue>,
    val hasSales: Boolean
)

sealed interface ClientResult<out T> {
    data class Success<T>(val value: T) : ClientResult<T>
    data object Unavailable : ClientResult<Nothing>
    data class Failure(
        val message: String,
        val fieldErrors: Map<String, String> = emptyMap(),
        val requiresLogin: Boolean = false
    ) : ClientResult<Nothing>
}
