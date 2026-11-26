package com.morestock.app.domain.validation

import java.math.BigDecimal
import java.util.Locale

object InventoryQuantityRules {
    private val wholeUnits = setOf(
        "pieza", "piezas", "pza", "pzas", "pz",
        "unidad", "unidades", "unid", "unids",
        "caja", "cajas", "paquete", "paquetes", "pack", "packs",
        "docena", "docenas",
    )

    private val decimalPattern = Regex("^(?:\\d+(?:[.,]\\d{1,3})?|[.,]\\d{1,3})$")

    fun error(value: String, unit: String): String? {
        val quantity = value.trim()
        return when {
            quantity.isEmpty() -> "Escribe una cantidad."
            quantity.startsWith('-') -> "La cantidad no puede ser negativa."
            maxFractionDigits(unit) == 0 && !quantity.matches(Regex("^\\d+$")) ->
                "Para $unit, usa una cantidad entera sin decimales."
            maxFractionDigits(unit) > 0 && !decimalPattern.matches(quantity) ->
                "Usa un número válido con hasta tres decimales."
            quantity.replace(',', '.').toDoubleOrNull()?.isFinite() != true ->
                "Usa un número válido con hasta tres decimales."
            else -> null
        }
    }

    fun parse(value: String, unit: String): Double? = if (error(value, unit) == null) {
        value.trim().replace(',', '.').toDoubleOrNull()
    } else {
        null
    }

    fun error(quantity: Double, unit: String): String? = when {
        !quantity.isFinite() -> "Usa una cantidad numérica válida."
        quantity < 0 -> "La cantidad no puede ser negativa."
        !fitsPrecision(quantity, unit) -> precisionError(unit)
        else -> null
    }

    fun isValid(quantity: Double, unit: String): Boolean = error(quantity, unit) == null

    private fun maxFractionDigits(unit: String): Int =
        if (unit.trim().lowercase(Locale.ROOT) in wholeUnits) 0 else 3

    private fun fitsPrecision(quantity: Double, unit: String): Boolean {
        val scale = BigDecimal.valueOf(quantity).stripTrailingZeros().scale().coerceAtLeast(0)
        return scale <= maxFractionDigits(unit)
    }

    private fun precisionError(unit: String): String = if (maxFractionDigits(unit) == 0) {
        "Para $unit, usa una cantidad entera sin decimales."
    } else {
        "Usa un número válido con hasta tres decimales."
    }
}
