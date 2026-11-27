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
import com.morestock.app.domain.validation.InventoryQuantityRules
import kotlinx.coroutines.async
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.IOException
import java.net.SocketTimeoutException

enum class BusinessTab {
    SUMMARY,
    CATALOG,
    INVENTORY,
    RECOMMENDATIONS,
    PROFILE,
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
    val isInventoryCheckingLatest: Boolean = false,
    val inventoryUpdateVersion: Int = 0,
    val error: String? = null,
    val canRetry: Boolean = false,
    val authRetryAfterSeconds: Long? = null,
) {
    val isLoading: Boolean
        get() = isLoginLoading || isBusinessLoading || isForecastLoading || isInventoryUpdating
}

class MoreStockViewModel(private val repository: MoreStockDataSource) : ViewModel() {
    private val mutableState = MutableStateFlow(MoreStockUiState())
    val state: StateFlow<MoreStockUiState> = mutableState.asStateFlow()
    private var businessLoadJob: Job? = null
    private var forecastLoadJob: Job? = null
    private var authRetryJob: Job? = null

    fun login(email: String, password: String) {
        if (mutableState.value.isLoginLoading || mutableState.value.authRetryAfterSeconds != null) return
        viewModelScope.launch {
            mutableState.update { it.copy(isLoginLoading = true, error = null, canRetry = false) }
            try {
                val session = repository.login(email.trim(), password)
                storeSession(session)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                showAuthError(error, "No se pudo iniciar sesión.")
            }
        }
    }

    fun register(email: String, password: String, businessName: String) {
        if (mutableState.value.isLoginLoading || mutableState.value.authRetryAfterSeconds != null) return
        viewModelScope.launch {
            mutableState.update { it.copy(isLoginLoading = true, error = null, canRetry = false) }
            try {
                val session = repository.register(email.trim(), password, businessName.trim())
                storeSession(session)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                showAuthError(error, "No se pudo crear la cuenta.")
            }
        }
    }

    private fun showAuthError(error: Exception, fallback: String) {
        val waitSeconds = (error as? MoreStockApiException)
            ?.takeIf { it.statusCode == 429 }
            ?.retryAfterSeconds
            ?.takeIf { it > 0 }
        authRetryJob?.cancel()
        mutableState.update {
            it.copy(
                isLoginLoading = false,
                error = readableError(error, fallback),
                canRetry = error is SocketTimeoutException,
                authRetryAfterSeconds = waitSeconds,
            )
        }
        if (waitSeconds != null) {
            authRetryJob = viewModelScope.launch {
                for (remaining in waitSeconds downTo 1) {
                    mutableState.update { it.copy(authRetryAfterSeconds = remaining) }
                    delay(1_000)
                }
                mutableState.update { it.copy(authRetryAfterSeconds = null) }
            }
        }
    }

    fun clearError() {
        mutableState.update { it.copy(error = null, canRetry = false) }
    }

    private fun storeSession(session: com.morestock.app.data.UserSession) {
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
                selectedTab = BusinessTab.SUMMARY,
                isLoginLoading = false,
                isBusinessLoading = false,
                isForecastLoading = false,
                isInventoryUpdating = false,
                isInventoryCheckingLatest = false,
                error = null,
                canRetry = false,
                authRetryAfterSeconds = null,
            )
        }
        authRetryJob?.cancel()
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
                    BusinessOverview(products.await(), inventory.await())
                }
                if (mutableState.value.selectedBusiness?.id != business.id) return@launch
                mutableState.update {
                    it.copy(
                        products = overview.products,
                        inventory = overview.inventory,
                        recommendations = emptyList(),
                        selectedForecast = null,
                        isBusinessLoading = false,
                    )
                }
                val recommendations = loadRecommendationsWhenReady(token, business.id)
                if (mutableState.value.selectedBusiness?.id != business.id) return@launch
                mutableState.update { it.copy(recommendations = recommendations) }
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

    fun updateInventory(
        productId: String,
        quantity: Double,
        unit: String? = null,
        expectedQuantity: Double? = null,
        expectedUnit: String? = null,
    ) {
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
        val unitToSave = unit?.takeIf(String::isNotBlank)
            ?: current.inventory.firstOrNull { it.sku == productId }?.unit
            ?: product.unit
        val validationError = InventoryQuantityRules.error(quantity, unitToSave)
        if (validationError != null) {
            mutableState.update {
                it.copy(error = validationError, canRetry = false)
            }
            return
        }
        if (current.isInventoryUpdating) return
        val shouldCheckLatest = expectedQuantity != null && expectedUnit != null

        mutableState.update {
            it.copy(
                isInventoryUpdating = true,
                isInventoryCheckingLatest = shouldCheckLatest,
                error = null,
                canRetry = false,
            )
        }
        viewModelScope.launch {
            try {
                if (shouldCheckLatest) {
                    val latestInventory = repository.getInventory(token, business.id)
                    if (mutableState.value.selectedBusiness?.id != business.id) return@launch
                    val latestItem = latestInventory.firstOrNull { it.sku == product.sku }
                    mutableState.update { it.copy(inventory = latestInventory, isInventoryCheckingLatest = false) }
                    if (latestItem == null || latestItem.quantity != expectedQuantity || latestItem.unit != expectedUnit) {
                        mutableState.update {
                            it.copy(
                                error = if (latestItem == null) {
                                    "Este producto ya no tiene una existencia registrada. Actualiza la lista antes de continuar."
                                } else {
                                    "El inventario cambió mientras editabas. Revisa el dato actualizado y vuelve a guardar si quieres conservar tu cantidad."
                                },
                                canRetry = false,
                            )
                        }
                        return@launch
                    }
                }
                val updated = repository.updateInventory(token, business.id, product.sku, quantity, unitToSave)
                if (mutableState.value.selectedBusiness?.id != business.id) return@launch
                mutableState.update { state ->
                    state.copy(
                        inventory = state.inventory.filterNot { it.sku == updated.sku } + updated,
                        inventoryUpdateVersion = state.inventoryUpdateVersion + 1,
                    )
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
                mutableState.update { it.copy(isInventoryUpdating = false, isInventoryCheckingLatest = false) }
            }
        }
    }

    fun logout() {
        businessLoadJob?.cancel()
        forecastLoadJob?.cancel()
        authRetryJob?.cancel()
        val token = mutableState.value.token
        mutableState.update { MoreStockUiState() }
        if (token != null) viewModelScope.launch { runCatching { repository.logout(token) } }
    }

    private data class BusinessOverview(
        val products: List<Product>,
        val inventory: List<InventoryItem>,
    )

    private suspend fun loadRecommendationsWhenReady(
        token: String,
        businessId: String,
    ): List<Recommendation> {
        repeat(12) { attempt ->
            try {
                return repository.getRecommendations(token, businessId)
            } catch (error: CancellationException) {
                throw error
            } catch (error: MoreStockApiException) {
                if (error.statusCode != 503 || attempt == 11) return emptyList()
                delay((error.retryAfterSeconds ?: 10).coerceIn(1, 30) * 1_000)
            } catch (_: Exception) {
                return emptyList()
            }
        }
        return emptyList()
    }

    private fun readableError(error: Exception, fallback: String): String = when (error) {
        is SocketTimeoutException -> "El servidor está tardando en responder. Revisa tu conexión e inténtalo de nuevo."
        is MoreStockApiException -> when (error.statusCode) {
            429 -> "El servidor limitó temporalmente las solicitudes."
            else -> error.message?.takeIf(String::isNotBlank) ?: fallback
        }
        is IOException -> "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo."
        else -> error.message?.takeIf(String::isNotBlank) ?: fallback
    }
}
