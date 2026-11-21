package com.morestock.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.morestock.app.data.Business
import com.morestock.app.data.Forecast
import com.morestock.app.data.InventoryItem
import com.morestock.app.data.MoreStockDataSource
import com.morestock.app.data.Product
import com.morestock.app.data.Recommendation
import kotlinx.coroutines.async
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

enum class BusinessTab {
    SUMMARY,
    CATALOG,
    INVENTORY,
    RECOMMENDATIONS,
}

data class MoreStockUiState(
    val token: String? = null,
    val email: String = "",
    val businesses: List<Business> = emptyList(),
    val selectedBusiness: Business? = null,
    val products: List<Product> = emptyList(),
    val inventory: List<InventoryItem> = emptyList(),
    val recommendations: List<Recommendation> = emptyList(),
    val selectedForecast: Forecast? = null,
    val selectedProductId: String? = null,
    val selectedTab: BusinessTab = BusinessTab.SUMMARY,
    val isLoginLoading: Boolean = false,
    val isBusinessLoading: Boolean = false,
    val isForecastLoading: Boolean = false,
    val error: String? = null,
) {
    val isLoading: Boolean
        get() = isLoginLoading || isBusinessLoading || isForecastLoading
}

class MoreStockViewModel(private val repository: MoreStockDataSource) : ViewModel() {
    private val mutableState = MutableStateFlow(MoreStockUiState())
    val state: StateFlow<MoreStockUiState> = mutableState.asStateFlow()
    private var businessLoadJob: Job? = null
    private var forecastLoadJob: Job? = null

    fun login(email: String, password: String) {
        viewModelScope.launch {
            mutableState.update { it.copy(isLoginLoading = true, error = null) }
            try {
                val session = repository.login(email.trim(), password)
                mutableState.update {
                    it.copy(
                        token = session.token,
                        email = session.email,
                        businesses = session.businesses,
                        selectedBusiness = null,
                        products = emptyList(),
                        inventory = emptyList(),
                        recommendations = emptyList(),
                        selectedForecast = null,
                        selectedProductId = null,
                        isLoginLoading = false,
                    )
                }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                mutableState.update { it.copy(isLoginLoading = false, error = error.message ?: "No se pudo iniciar sesión.") }
            }
        }
    }

    fun selectBusiness(business: Business) {
        val token = mutableState.value.token ?: return
        businessLoadJob?.cancel()
        forecastLoadJob?.cancel()
        mutableState.update {
            it.copy(
                selectedBusiness = business,
                products = emptyList(),
                inventory = emptyList(),
                recommendations = emptyList(),
                selectedForecast = null,
                selectedProductId = null,
                selectedTab = BusinessTab.SUMMARY,
                isBusinessLoading = true,
                isForecastLoading = false,
                error = null,
            )
        }
        businessLoadJob = viewModelScope.launch {
            try {
                val overview = coroutineScope {
                    val products = async { repository.getProducts(token, business.id) }
                    val inventory = async { repository.getInventory(token, business.id) }
                    val recommendations = async { repository.getRecommendations(token, business.id) }
                    BusinessOverview(products.await(), inventory.await(), recommendations.await())
                }
                if (mutableState.value.selectedBusiness?.id != business.id) return@launch
                mutableState.update {
                    it.copy(
                        products = overview.products,
                        inventory = overview.inventory,
                        recommendations = overview.recommendations,
                        selectedForecast = null,
                        isBusinessLoading = false,
                    )
                }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                if (mutableState.value.selectedBusiness?.id != business.id) return@launch
                mutableState.update { it.copy(isBusinessLoading = false, error = error.message ?: "No se pudo cargar el negocio.") }
            }
        }
    }

    fun selectTab(tab: BusinessTab) {
        forecastLoadJob?.cancel()
        mutableState.update {
            it.copy(
                selectedTab = tab,
                selectedProductId = null,
                selectedForecast = null,
                isForecastLoading = false,
                error = null,
            )
        }
    }

    fun selectProduct(productId: String) {
        val token = mutableState.value.token ?: return
        val business = mutableState.value.selectedBusiness ?: return
        forecastLoadJob?.cancel()
        mutableState.update { it.copy(selectedProductId = productId, selectedForecast = null, isForecastLoading = true, error = null) }
        forecastLoadJob = viewModelScope.launch {
            try {
                val forecast = repository.getForecast(token, business.id, productId)
                if (mutableState.value.selectedBusiness?.id != business.id || mutableState.value.selectedProductId != productId) return@launch
                mutableState.update { it.copy(selectedForecast = forecast, isForecastLoading = false) }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                if (mutableState.value.selectedBusiness?.id != business.id || mutableState.value.selectedProductId != productId) return@launch
                mutableState.update { it.copy(isForecastLoading = false, error = error.message ?: "No se pudo cargar el pronóstico.") }
            }
        }
    }

    fun goBackToBusinesses() {
        businessLoadJob?.cancel()
        forecastLoadJob?.cancel()
        mutableState.update {
            it.copy(
                selectedBusiness = null,
                products = emptyList(),
                inventory = emptyList(),
                recommendations = emptyList(),
                selectedForecast = null,
                selectedProductId = null,
                isBusinessLoading = false,
                isForecastLoading = false,
                error = null,
            )
        }
    }

    fun goBackToBusiness() {
        forecastLoadJob?.cancel()
        mutableState.update {
            it.copy(selectedProductId = null, selectedForecast = null, error = null, isForecastLoading = false)
        }
    }

    fun refresh() {
        mutableState.value.selectedBusiness?.let(::selectBusiness)
    }

    fun logout() {
        businessLoadJob?.cancel()
        forecastLoadJob?.cancel()
        val token = mutableState.value.token
        mutableState.update { MoreStockUiState() }
        if (token != null) viewModelScope.launch { runCatching { repository.logout(token) } }
    }

    private data class BusinessOverview(
        val products: List<Product>,
        val inventory: List<InventoryItem>,
        val recommendations: List<Recommendation>,
    )
}
