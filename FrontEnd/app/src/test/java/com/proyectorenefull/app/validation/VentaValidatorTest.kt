package com.proyectorenefull.app.validation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class VentaValidatorTest {
    @Test
    fun marksAllRequiredFieldsWhenEmpty() {
        val result = VentaValidator.validate("", "", "", "", null)

        assertFalse(result.isValid)
        assertEquals(VentaField.entries.toSet(), result.errors.keys)
    }

    @Test
    fun rejectsInvalidPriceAndQuantity() {
        val result = VentaValidator.validate(
            product = "Producto",
            category = "Categoría",
            unitPrice = "abc",
            quantity = "1.5",
            dateMillis = 1L
        )

        assertEquals("Ingresa un precio válido.", result.errors[VentaField.UnitPrice])
        assertEquals("Ingresa una cantidad entera.", result.errors[VentaField.Quantity])
    }

    @Test
    fun rejectsZeroAndNegativeValues() {
        val priceResult = VentaValidator.validate("A", "B", "0", "1", 1L)
        val quantityResult = VentaValidator.validate("A", "B", "1", "-2", 1L)

        assertEquals("El precio debe ser mayor que cero.", priceResult.errors[VentaField.UnitPrice])
        assertEquals("La cantidad debe ser mayor que cero.", quantityResult.errors[VentaField.Quantity])
    }

    @Test
    fun acceptsValidSaleFields() {
        val result = VentaValidator.validate(
            product = "Producto",
            category = "Categoría",
            unitPrice = "10.50",
            quantity = "2",
            dateMillis = 1L
        )

        assertTrue(result.isValid)
    }

    @Test
    fun acceptsDecimalCommaForUnitPrice() {
        val result = VentaValidator.validate("Producto", "Categoría", "10,50", "2", 1L)

        assertTrue(result.isValid)
    }
}
