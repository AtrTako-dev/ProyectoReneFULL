package com.morestock.app.ui.presentation

import com.morestock.app.data.Product
import com.morestock.app.data.Recommendation
import org.junit.Assert.assertEquals
import org.junit.Test

class ProductListPresentationTest {
    @Test
    fun filtersBySearchCategoryAndRecommendationWithoutChangingSourceItems() {
        val products = listOf(
            product("P1", "Concha", "Panadería"),
            product("P2", "Bolillo", "Panadería"),
            product("P3", "Leche", "Lácteos"),
        )
        val recommendations = listOf(
            recommendation("P1", "COMPRAR"),
            recommendation("P2", "MANTENER"),
            recommendation("P3", "COMPRAR"),
        )

        val result = ProductListPresentation.filterAndSort(
            products = products,
            recommendations = recommendations,
            query = ProductListQuery(
                search = "con",
                category = "Panadería",
                recommendation = RecommendationFilter.BUY,
            ),
        )

        assertEquals(listOf("P1"), result.map(Product::sku))
        assertEquals(listOf("P1", "P2", "P3"), products.map(Product::sku))
    }

    @Test
    fun buySortUsesApiStatusWithoutComparingDifferentUnits() {
        val products = listOf(
            product("P1", "Bolillo", "Pan"),
            product("P2", "Concha", "Pan"),
            product("P3", "Leche", "Lácteos"),
            product("P4", "Azúcar", "Abarrotes"),
        )
        val recommendations = listOf(
            recommendation("P1", "NO_COMPRAR"),
            recommendation("P2", "COMPRAR"),
            recommendation("P3", "MANTENER"),
        )

        val result = ProductListPresentation.filterAndSort(
            products = products,
            recommendations = recommendations,
            query = ProductListQuery(sort = ProductSort.BUY_FIRST),
        )

        assertEquals(listOf("P2", "P3", "P1", "P4"), result.map(Product::sku))
    }

    @Test
    fun recommendationFiltersMatchAllStatusesDeliveredByTheApi() {
        val products = listOf(product("P1", "A", "Pan"), product("P2", "B", "Pan"), product("P3", "C", "Pan"))
        val recommendations = listOf(
            recommendation("P1", "COMPRAR"),
            recommendation("P2", "MANTENER"),
            recommendation("P3", "NO_COMPRAR"),
        )

        val results = RecommendationFilter.entries.associateWith { filter ->
            ProductListPresentation.filterAndSort(
                products = products,
                recommendations = recommendations,
                query = ProductListQuery(recommendation = filter),
            ).map(Product::sku)
        }

        assertEquals(listOf("P1", "P2", "P3"), results[RecommendationFilter.ALL])
        assertEquals(listOf("P1"), results[RecommendationFilter.BUY])
        assertEquals(listOf("P2"), results[RecommendationFilter.MAINTAIN])
        assertEquals(listOf("P3"), results[RecommendationFilter.DO_NOT_BUY])
    }

    private fun product(sku: String, name: String, category: String) =
        Product(sku, name, category, "", "pieza", null)

    private fun recommendation(sku: String, status: String) =
        Recommendation(sku, sku, "pieza", 0.0, 0.0, 0.0, 0.0, 0.0, status, "", "", null, null, false)
}
