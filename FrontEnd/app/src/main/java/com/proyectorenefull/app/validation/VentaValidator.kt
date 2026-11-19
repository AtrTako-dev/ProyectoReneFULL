package com.proyectorenefull.app.validation

import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.Locale

enum class VentaField {
    ProductId,
    UnitPrice,
    Quantity,
    Date
}

data class VentaValidationResult(val errors: Map<VentaField, String>) {
    val isValid: Boolean get() = errors.isEmpty()
}

object VentaValidator {
    private val productIdPattern = Regex("^[A-Z]{1,3}[0-9]{3}$")

    fun validate(
        productId: String,
        unitPrice: String,
        quantity: String,
        dateMillis: Long?
    ): VentaValidationResult {
        val errors = mutableMapOf<VentaField, String>()
        val normalizedProductId = productId.trim().uppercase(Locale.ROOT)
        if (normalizedProductId.isBlank()) {
            errors[VentaField.ProductId] = "Ingresa el ID del producto."
        } else if (!productIdPattern.matches(normalizedProductId)) {
            errors[VentaField.ProductId] = "Usa el formato del catálogo: de 1 a 3 letras y 3 números."
        }

        val parsedPrice = unitPrice.trim().replace(',', '.').toBigDecimalOrNull()
        when {
            unitPrice.isBlank() -> errors[VentaField.UnitPrice] = "Ingresa el precio unitario."
            parsedPrice == null -> errors[VentaField.UnitPrice] = "Ingresa un precio válido."
            parsedPrice <= BigDecimal.ZERO -> errors[VentaField.UnitPrice] = "El precio debe ser mayor que cero."
            parsedPrice > BigDecimal("1000000") -> errors[VentaField.UnitPrice] = "El precio no puede superar \$1,000,000 MXN."
            parsedPrice.stripTrailingZeros().scale() > 2 -> errors[VentaField.UnitPrice] = "El precio admite hasta dos decimales."
        }

        val parsedQuantity = quantity.trim().toIntOrNull()
        when {
            quantity.isBlank() -> errors[VentaField.Quantity] = "Ingresa la cantidad."
            parsedQuantity == null -> errors[VentaField.Quantity] = "Ingresa una cantidad entera."
            parsedQuantity !in 1..10_000 -> errors[VentaField.Quantity] = "La cantidad debe estar entre 1 y 10,000."
        }

        val date = dateMillis?.let { Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate() }
        val today = LocalDate.now(ZoneOffset.UTC)
        when {
            date == null -> errors[VentaField.Date] = "Selecciona la fecha de la venta."
            date.isBefore(LocalDate.of(2000, 1, 1)) -> errors[VentaField.Date] = "La fecha no puede ser anterior al 1 de enero de 2000."
            date.isAfter(today) -> errors[VentaField.Date] = "La fecha no puede ser futura."
        }

        return VentaValidationResult(errors)
    }
}
