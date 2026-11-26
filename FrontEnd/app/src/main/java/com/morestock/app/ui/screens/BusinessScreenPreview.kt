package com.morestock.app.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import com.morestock.app.data.Business
import com.morestock.app.data.InventoryItem
import com.morestock.app.data.Product
import com.morestock.app.data.Recommendation
import com.morestock.app.ui.theme.MoreStockTheme
import com.morestock.app.ui.viewmodel.BusinessTab

@Preview(name = "Inicio claro · datos de demostración", showBackground = true, showSystemUi = true)
@Composable
private fun BusinessSummaryLightPreview() {
    MoreStockTheme(darkTheme = false) {
        BusinessScreen(
            business = demoBusiness,
            products = demoProducts,
            inventory = demoInventory,
            recommendations = demoRecommendations,
            selectedTab = BusinessTab.SUMMARY,
            isLoading = false,
            isInventoryUpdating = false,
            isInventoryCheckingLatest = false,
            inventoryUpdateVersion = 0,
            error = null,
            canRetry = false,
            onSelectTab = {},
            onSelectProduct = {},
            onUpdateInventory = { _, _, _, _, _ -> },
            onClearError = {},
            onBack = {},
            onRefresh = {},
        )
    }
}

@Preview(name = "Inicio oscuro · datos de demostración", showBackground = true, showSystemUi = true)
@Composable
private fun BusinessSummaryDarkPreview() {
    MoreStockTheme(darkTheme = true) {
        BusinessScreen(
            business = demoBusiness,
            products = demoProducts,
            inventory = demoInventory,
            recommendations = demoRecommendations,
            selectedTab = BusinessTab.SUMMARY,
            isLoading = false,
            isInventoryUpdating = false,
            isInventoryCheckingLatest = false,
            inventoryUpdateVersion = 0,
            error = null,
            canRetry = false,
            onSelectTab = {},
            onSelectProduct = {},
            onUpdateInventory = { _, _, _, _, _ -> },
            onClearError = {},
            onBack = {},
            onRefresh = {},
        )
    }
}

@Preview(name = "Catálogo vacío", showBackground = true, showSystemUi = true)
@Composable
private fun BusinessEmptyPreview() {
    MoreStockTheme {
        BusinessScreen(
            business = demoBusiness,
            products = emptyList(),
            inventory = emptyList(),
            recommendations = emptyList(),
            selectedTab = BusinessTab.CATALOG,
            isLoading = false,
            isInventoryUpdating = false,
            isInventoryCheckingLatest = false,
            inventoryUpdateVersion = 0,
            error = null,
            canRetry = false,
            onSelectTab = {},
            onSelectProduct = {},
            onUpdateInventory = { _, _, _, _, _ -> },
            onClearError = {},
            onBack = {},
            onRefresh = {},
        )
    }
}

@Preview(name = "Error de carga", showBackground = true, showSystemUi = true)
@Composable
private fun BusinessErrorPreview() {
    MoreStockTheme {
        BusinessScreen(
            business = demoBusiness,
            products = emptyList(),
            inventory = emptyList(),
            recommendations = emptyList(),
            selectedTab = BusinessTab.SUMMARY,
            isLoading = false,
            isInventoryUpdating = false,
            isInventoryCheckingLatest = false,
            inventoryUpdateVersion = 0,
            error = "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
            canRetry = true,
            onSelectTab = {},
            onSelectProduct = {},
            onUpdateInventory = { _, _, _, _, _ -> },
            onClearError = {},
            onBack = {},
            onRefresh = {},
        )
    }
}

private val demoBusiness = Business("demo", "Abarrotes La Esquina", "business_admin")

private val demoProducts = listOf(
    Product("P-001", "Manzana roja", "Frutas", "", "kg", null),
    Product("P-002", "Concha", "Panadería", "", "pieza", null),
    Product("P-003", "Leche entera", "Lácteos", "", "litro", null),
    Product("P-004", "Cuaderno profesional", "Papelería", "", "pieza", null),
)

private val demoInventory = listOf(
    InventoryItem("P-001", "Manzana roja", 4.5, "kg", true, "synthetic"),
    InventoryItem("P-002", "Concha", 12.0, "pieza", true, "synthetic"),
    InventoryItem("P-003", "Leche entera", 3.0, "litro", true, "synthetic"),
    InventoryItem("P-004", "Cuaderno profesional", 18.0, "pieza", true, "synthetic"),
)

private val demoRecommendations = listOf(
    Recommendation("P-001", "Manzana roja", "kg", 4.5, 9.0, 9.0, 5.0, 9.5, "COMPRAR", "El inventario está por debajo de la demanda esperada.", "Modelo de demostración", null, null, true),
    Recommendation("P-002", "Concha", "pieza", 12.0, 10.0, 10.0, 0.0, 12.0, "MANTENER", "La existencia actual cubre la demanda esperada.", "Modelo de demostración", null, null, true),
    Recommendation("P-003", "Leche entera", "litro", 3.0, 2.0, 2.0, 0.0, 3.0, "NO_COMPRAR", "La existencia actual es suficiente.", "Modelo de demostración", null, null, true),
)
