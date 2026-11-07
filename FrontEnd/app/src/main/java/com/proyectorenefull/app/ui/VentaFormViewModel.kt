package com.proyectorenefull.app.ui

import androidx.lifecycle.ViewModel
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
    val message: String? = null
)

class VentaFormViewModel : ViewModel() {
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
        _state.value = current.copy(
            errors = result.errors,
            message = if (result.isValid) {
                "La venta no se envió ni se guardó en esta vista previa."
            } else null
        )
    }

    private fun update(transform: (VentaFormUiState) -> VentaFormUiState) {
        _state.update { transform(it).copy(errors = emptyMap(), message = null) }
    }
}
