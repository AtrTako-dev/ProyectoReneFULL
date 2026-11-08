package com.proyectorenefull.app.ui

import androidx.lifecycle.ViewModel
import com.proyectorenefull.app.domain.client.ClientRepository
import com.proyectorenefull.app.domain.client.ClientResult
import com.proyectorenefull.app.domain.client.SaleDraft
import com.proyectorenefull.app.validation.VentaField
import com.proyectorenefull.app.validation.VentaValidator
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class VentaFormUiState(
    val product: String = "",
    val category: String = "",
    val unitPrice: String = "",
    val quantity: String = "",
    val dateMillis: Long? = null,
    val errors: Map<VentaField, String> = emptyMap(),
    val message: String? = null,
    val isSubmitting: Boolean = false
)

class VentaFormViewModel(private val repository: ClientRepository) : ViewModel() {
    private val _state = MutableStateFlow(VentaFormUiState())
    val state = _state.asStateFlow()

    fun updateProduct(value: String) = update { it.copy(product = value) }
    fun updateCategory(value: String) = update { it.copy(category = value) }
    fun updateUnitPrice(value: String) = update { it.copy(unitPrice = value) }
    fun updateQuantity(value: String) = update { it.copy(quantity = value) }
    fun updateDate(value: Long?) = update { it.copy(dateMillis = value) }

    fun submit() {
        val current = _state.value
        val result = VentaValidator.validate(
            product = current.product,
            category = current.category,
            unitPrice = current.unitPrice,
            quantity = current.quantity,
            dateMillis = current.dateMillis
        )
        if (!result.isValid) {
            _state.value = current.copy(errors = result.errors, message = null)
            return
        }
        _state.value = current.copy(errors = emptyMap(), isSubmitting = true, message = null)
        repository.createSale(
            SaleDraft(
                product = current.product.trim(),
                category = current.category,
                unitPriceMxn = current.unitPrice.trim().replace(',', '.').toBigDecimal(),
                quantity = current.quantity.trim().toInt(),
                dateMillis = requireNotNull(current.dateMillis)
            )
        ) { response ->
            _state.value = when (response) {
                is ClientResult.Success -> VentaFormUiState(message = "Venta registrada.")
                ClientResult.Unavailable -> current.copy(isSubmitting = false, message = "El servicio de ventas no está disponible. No se guardó la venta.")
                is ClientResult.Failure -> current.copy(isSubmitting = false, message = "No se pudo registrar la venta. Verifica tus registros antes de volver a intentarlo.")
            }
        }
    }

    private fun update(transform: (VentaFormUiState) -> VentaFormUiState) {
        _state.update { transform(it).copy(errors = emptyMap(), message = null) }
    }
}
