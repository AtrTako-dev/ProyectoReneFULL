package com.morestock.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.morestock.app.data.Business
import com.morestock.app.data.Forecast
import com.morestock.app.data.InventoryItem
import com.morestock.app.data.MoreStockApiException
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
import java.io.IOException
import java.net.SocketTimeoutException

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
    val isInventoryUpdating: Boolean = false,
    val error: String? = null,
    val canRetry: Boolean = false,
) {
    val isLoading: Boolean
        get() = isLoginLoading || isBusinessLoading || isForecastLoading || isInventoryUpdating
}

class MoreStockViewModel(private val repository: MoreStockDataSource) : ViewModel() {
    private val mutableState = MutableStateFlow(MoreStockUiState())
    val state: StateFlow<MoreStockUiState> = mutableState.asStateFlow()
    private var businessLoadJob: Job? = null
    private var forecastLoadJob: Job? = null

    fun login(email: String, password: String) {
        viewModelScope.launch {
            mutableState.update { it.copy(isLoginLoading = true, error = null, canRetry = false) }
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
                        canRetry = false,
                    )
                }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                mutableState.update {
                    it.copy(
                        isLoginLoading = false,
                        error = readableError(error, "No se pudo iniciar sesión."),
                        canRetry = error is SocketTimeoutException,
                    )
                }
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
                canRetry = false,
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
                mutableState.update {
                    it.copy(
                        isBusinessLoading = false,
                        error = readableError(error, "No se pudo cargar el negocio."),
                        canRetry = error is SocketTimeoutException,
                    )
                }
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
                canRetry = false,
            )
        }
    }

    fun selectProduct(productId: String) {
        val token = mutableState.value.token ?: return
        val business = mutableState.value.selectedBusiness ?: return
        forecastLoadJob?.cancel()
        mutableState.update {
            it.copy(selectedProductId = productId, selectedForecast = null, isForecastLoading = true, error = null, canRetry = false)
        }
        forecastLoadJob = viewModelScope.launch {
            try {
                val forecast = repository.getForecast(token, business.id, productId)
                if (mutableState.value.selectedBusiness?.id != business.id || mutableState.value.selectedProductId != productId) return@launch
                mutableState.update { it.copy(selectedForecast = forecast, isForecastLoading = false) }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                if (mutableState.value.selectedBusiness?.id != business.id || mutableState.value.selectedProductId != productId) return@launch
                mutableState.update {
                    it.copy(
                        isForecastLoading = false,
                        error = readableError(error, "No se pudo cargar el pronóstico."),
                        canRetry = error is SocketTimeoutException,
                    )
                }
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
                canRetry = false,
            )
        }
    }

    fun goBackToBusiness() {
        forecastLoadJob?.cancel()
        mutableState.update {
            it.copy(selectedProductId = null, selectedForecast = null, error = null, canRetry = false, isForecastLoading = false)
        }
    }

    fun refresh() {
        mutableState.value.selectedBusiness?.let(::selectBusiness)
    }

    fun updateInventory(productId: String, quantity: Double) {
        val current = mutableState.value
        val token = current.token
        val business = current.selectedBusiness
        val product = current.products.firstOrNull { it.sku == productId }
        if (token == null || business == null || product == null) {
            mutableState.update {
                it.copy(error = "Selecciona un producto de un negocio antes de actualizar el inventario.", canRetry = false)
            }
            return
        }
        if (!quantity.isValidInventoryQuantity()) {
            mutableState.update {
                it.copy(
                    error = "La cantidad debe ser un número válido, mayor o igual a cero y con hasta tres decimales.",
                    canRetry = false,
                )
            }
            return
        }
        if (current.isInventoryUpdating) return

        mutableState.update { it.copy(isInventoryUpdating = true, error = null, canRetry = false) }
        viewModelScope.launch {
            try {
                val updated = repository.updateInventory(token, business.id, product.sku, quantity, product.unit)
                if (mutableState.value.selectedBusiness?.id != business.id) return@launch
                mutableState.update { state ->
                    state.copy(inventory = state.inventory.filterNot { it.sku == updated.sku } + updated)
                }
                refresh()
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                if (mutableState.value.selectedBusiness?.id != business.id) return@launch
                mutableState.update {
                    it.copy(
                        error = readableError(error, "No se pudo actualizar el inventario."),
                        canRetry = error is SocketTimeoutException,
                    )
                }
            } finally {
                mutableState.update { it.copy(isInventoryUpdating = false) }
            }
        }
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

    private fun readableError(error: Exception, fallback: String): String = when (error) {
        is SocketTimeoutException -> "El servidor está tardando en responder. Revisa tu conexión e inténtalo de nuevo."
        is MoreStockApiException -> when (error.statusCode) {
            429 -> "El servidor limitó temporalmente las solicitudes. Espera un momento e inténtalo de nuevo."
            else -> error.message?.takeIf(String::isNotBlank) ?: fallback
        }
        is IOException -> "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo."
        else -> error.message?.takeIf(String::isNotBlank) ?: fallback
    }
}

private fun Double.isValidInventoryQuantity(): Boolean =
    isFinite() && this >= 0 && kotlin.math.abs(this * 1000.0 - kotlin.math.round(this * 1000.0)) < 0.0000001
