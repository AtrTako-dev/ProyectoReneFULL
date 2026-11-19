package com.proyectorenefull.app.model.admin

import java.math.BigDecimal

data class AdminCategoryStatistic(
    val category: String,
    val transactions: Int,
    val units: Int,
    val amountMxn: BigDecimal
)

data class AdminStatistics(
    val unit: String,
    val period: String,
    val summary: List<Pair<String, String>>,
    val categories: List<AdminCategoryStatistic>
)

data class AdminUser(
    val id: String,
    val name: String,
    val email: String,
    val role: String,
    val active: Boolean
)
