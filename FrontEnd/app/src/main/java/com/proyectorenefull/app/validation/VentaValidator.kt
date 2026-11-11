package com.proyectorenefull.app.validation

import java.math.BigDecimal

enum class VentaField {
    Product,
    Category,
    UnitPrice,
    Quantity,
    Date
}

data class VentaValidationResult(
    val errors: Map<VentaField, String>
) {
    val isValid: Boolean get() = errors.isEmpty()
}

object VentaValidator {
    fun validate(
        product: String,
        category: String,
        unitPrice: String,
        quantity: String,
        dateMillis: Long?
    ): VentaValidationResult {
        val errors = mutableMapOf<VentaField, String>()

        if (product.isBlank()) errors[VentaField.Product] = "Ingresa el producto."
        if (category.isBlank()) errors[VentaField.Category] = "Selecciona una categoría."

        val parsedPrice = unitPrice.trim().replace(',', '.').toBigDecimalOrNull()
        when {
            unitPrice.isBlank() -> errors[VentaField.UnitPrice] = "Ingresa el precio unitario."
            parsedPrice == null -> errors[VentaField.UnitPrice] = "Ingresa un precio válido."
            parsedPrice <= BigDecimal.ZERO -> errors[VentaField.UnitPrice] = "El precio debe ser mayor que cero."
        }

        val parsedQuantity = quantity.trim().toIntOrNull()
        when {
            quantity.isBlank() -> errors[VentaField.Quantity] = "Ingresa la cantidad."
            parsedQuantity == null -> errors[VentaField.Quantity] = "Ingresa una cantidad entera."
            parsedQuantity <= 0 -> errors[VentaField.Quantity] = "La cantidad debe ser mayor que cero."
        }

        if (dateMillis == null) errors[VentaField.Date] = "Selecciona la fecha de la venta."

        return VentaValidationResult(errors)
    }
}
