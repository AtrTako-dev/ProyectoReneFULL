package com.morestock.app.ui.presentation

import com.morestock.app.data.Product
import com.morestock.app.data.Recommendation
import java.util.Locale

enum class RecommendationFilter {
    ALL,
    BUY,
    MAINTAIN,
    DO_NOT_BUY,
}

enum class ProductSort {
    NAME_ASC,
    NAME_DESC,
    BUY_FIRST,
}

data class ProductListQuery(
    val search: String = "",
    val category: String? = null,
    val recommendation: RecommendationFilter = RecommendationFilter.ALL,
    val sort: ProductSort = ProductSort.NAME_ASC,
)

object ProductListPresentation {
    fun categories(products: List<Product>): List<String> = products
        .map(Product::category)
        .filter(String::isNotBlank)
        .distinctBy { it.lowercase(Locale.ROOT) }
        .sortedBy { it.lowercase(Locale.ROOT) }

    fun filterAndSort(
        products: List<Product>,
        recommendations: List<Recommendation>,
        query: ProductListQuery,
    ): List<Product> {
        val recommendationBySku = recommendations.associateBy(Recommendation::sku)
        val search = query.search.trim().lowercase(Locale.ROOT)

        val filtered = products.filter { product ->
            val matchesSearch = search.isEmpty() || listOf(product.name, product.category, product.brand, product.sku)
                .any { it.lowercase(Locale.ROOT).contains(search) }
            val matchesCategory = query.category.isNullOrBlank() || product.category.equals(query.category, ignoreCase = true)
            val matchesRecommendation = when (query.recommendation) {
                RecommendationFilter.ALL -> true
                RecommendationFilter.BUY -> recommendationBySku[product.sku].isStatus("COMPRAR")
                RecommendationFilter.MAINTAIN -> recommendationBySku[product.sku].isStatus("MANTENER")
                RecommendationFilter.DO_NOT_BUY -> recommendationBySku[product.sku].isStatus("NO_COMPRAR")
            }
            matchesSearch && matchesCategory && matchesRecommendation
        }

        return when (query.sort) {
            ProductSort.NAME_ASC -> filtered.sortedBy { it.name.lowercase(Locale.ROOT) }
            ProductSort.NAME_DESC -> filtered.sortedByDescending { it.name.lowercase(Locale.ROOT) }
            ProductSort.BUY_FIRST -> filtered.sortedWith(
                compareBy<Product> { recommendationBySku[it.sku]?.status.sortRank() }
                    .thenBy { it.name.lowercase(Locale.ROOT) },
            )
        }
    }

    private fun Recommendation?.isStatus(expected: String): Boolean =
        this?.status?.replace(' ', '_')?.uppercase(Locale.ROOT) == expected

    private fun String?.sortRank(): Int = when (this?.replace(' ', '_')?.uppercase(Locale.ROOT)) {
        "COMPRAR" -> 0
        "MANTENER" -> 1
        "NO_COMPRAR" -> 2
        else -> 3
    }
}
