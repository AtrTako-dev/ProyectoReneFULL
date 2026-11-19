package com.proyectorenefull.app.viewmodel

import androidx.lifecycle.ViewModel
import com.proyectorenefull.app.model.client.ClientRepository
import com.proyectorenefull.app.model.client.ClientResult
import com.proyectorenefull.app.model.client.SaleDraft
import com.proyectorenefull.app.validation.VentaField
import com.proyectorenefull.app.validation.VentaValidator
import java.util.UUID
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class VentaFormUiState(
    val productId: String = "",
    val unitPrice: String = "",
    val quantity: String = "",
    val dateMillis: Long? = null,
    val errors: Map<VentaField, String> = emptyMap(),
    val message: String? = null,
    val isSubmitting: Boolean = false,
    val sessionExpired: Boolean = false
)

class VentaFormViewModel(private val repository: ClientRepository) : ViewModel() {
    private val _state = MutableStateFlow(VentaFormUiState())
    val state = _state.asStateFlow()
    private var pendingIdempotencyKey: String? = null

    fun updateProductId(value: String) = update { it.copy(productId = value) }
    fun updateUnitPrice(value: String) = update { it.copy(unitPrice = value) }
    fun updateQuantity(value: String) = update { it.copy(quantity = value) }
    fun updateDate(value: Long?) = update { it.copy(dateMillis = value) }

    fun submit() {
        val current = _state.value
        if (current.isSubmitting) return
        val validation = VentaValidator.validate(
            productId = current.productId,
            unitPrice = current.unitPrice,
            quantity = current.quantity,
            dateMillis = current.dateMillis
        )
        if (!validation.isValid) {
            _state.value = current.copy(errors = validation.errors, message = null)
            return
        }

        val idempotencyKey = pendingIdempotencyKey ?: UUID.randomUUID().toString().also {
            pendingIdempotencyKey = it
        }
        _state.value = current.copy(errors = emptyMap(), isSubmitting = true, message = null, sessionExpired = false)
        repository.createSale(
            SaleDraft(
                productId = current.productId.trim().uppercase(),
                unitPriceMxn = current.unitPrice.trim().replace(',', '.').toBigDecimal(),
                quantity = current.quantity.trim().toInt(),
                dateMillis = requireNotNull(current.dateMillis),
                idempotencyKey = idempotencyKey
            )
        ) { response ->
            when (response) {
                is ClientResult.Success -> {
                    pendingIdempotencyKey = null
                    _state.value = VentaFormUiState(message = "Venta registrada.")
                }
                ClientResult.Unavailable -> _state.update {
                    it.copy(isSubmitting = false, message = "El servicio no está disponible. La venta no se guardó.")
                }
                is ClientResult.Failure -> _state.update {
                    it.copy(
                        isSubmitting = false,
                        message = response.message,
                        errors = response.fieldErrors.toSaleFieldErrors(),
                        sessionExpired = response.requiresLogin
                    )
                }
            }
        }
    }

    fun clearSessionExpired() {
        _state.update { it.copy(sessionExpired = false) }
    }

    fun resetSession() {
        pendingIdempotencyKey = null
        _state.value = VentaFormUiState()
    }

    private fun update(transform: (VentaFormUiState) -> VentaFormUiState) {
        pendingIdempotencyKey = null
        _state.update { transform(it).copy(errors = emptyMap(), message = null, sessionExpired = false) }
    }

    private fun Map<String, String>.toSaleFieldErrors(): Map<VentaField, String> = buildMap {
        this@toSaleFieldErrors["producto_id"]?.let { put(VentaField.ProductId, it) }
        this@toSaleFieldErrors["precio_unitario_mxn"]?.let { put(VentaField.UnitPrice, it) }
        this@toSaleFieldErrors["cantidad"]?.let { put(VentaField.Quantity, it) }
        this@toSaleFieldErrors["fecha"]?.let { put(VentaField.Date, it) }
    }
}
