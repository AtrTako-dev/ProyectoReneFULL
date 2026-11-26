package com.morestock.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import com.morestock.app.ui.screens.BusinessScreen
import com.morestock.app.ui.screens.BusinessesScreen
import com.morestock.app.ui.screens.LoginScreen
import com.morestock.app.ui.screens.ProductDetailScreen
import com.morestock.app.ui.viewmodel.MoreStockViewModel

@Composable
fun MoreStockApp(viewModel: MoreStockViewModel) {
    val state by viewModel.state.collectAsState()
    val selectedBusiness = state.selectedBusiness
    val selectedProduct = state.products.firstOrNull { it.sku == state.selectedProductId }

    BackHandler(enabled = selectedBusiness != null) {
        if (selectedProduct != null) viewModel.goBackToBusiness() else viewModel.goBackToBusinesses()
    }

    when {
        state.token == null -> LoginScreen(
            isLoading = state.isLoading,
            error = state.error,
            canRetry = state.canRetry,
            authRetryAfterSeconds = state.authRetryAfterSeconds,
            onLogin = viewModel::login,
            onRegister = viewModel::register,
            onClearError = viewModel::clearError,
        )

        selectedBusiness == null -> BusinessesScreen(
            email = state.email,
            businesses = state.businesses,
            isLoading = state.isLoading,
            error = state.error,
            onSelect = viewModel::selectBusiness,
            onLogout = viewModel::logout,
        )

        selectedProduct == null -> BusinessScreen(
            business = selectedBusiness,
            products = state.products,
            inventory = state.inventory,
            recommendations = state.recommendations,
            selectedTab = state.selectedTab,
            isLoading = state.isLoading,
            isInventoryUpdating = state.isInventoryUpdating,
            isInventoryCheckingLatest = state.isInventoryCheckingLatest,
            inventoryUpdateVersion = state.inventoryUpdateVersion,
            error = state.error,
            canRetry = state.canRetry,
            onSelectTab = viewModel::selectTab,
            onSelectProduct = viewModel::selectProduct,
            onUpdateInventory = viewModel::updateInventory,
            onClearError = viewModel::clearError,
            onBack = viewModel::goBackToBusinesses,
            onRefresh = viewModel::refresh,
        )

        else -> ProductDetailScreen(
            product = selectedProduct,
            inventory = state.inventory.firstOrNull { it.sku == selectedProduct.sku },
            recommendation = state.recommendations.firstOrNull { it.sku == selectedProduct.sku },
            forecast = state.selectedForecast,
            isLoading = state.isLoading,
            error = state.error,
            canRetry = state.canRetry,
            onBack = viewModel::goBackToBusiness,
            onRetry = { viewModel.selectProduct(selectedProduct.sku) },
        )
    }
}
