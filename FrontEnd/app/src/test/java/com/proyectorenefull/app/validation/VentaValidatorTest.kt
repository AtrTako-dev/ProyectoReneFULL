package com.proyectorenefull.app.validation

import java.time.LocalDate
import java.time.ZoneOffset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class VentaValidatorTest {
    private val validDate = LocalDate.of(2026, 5, 20).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()

    @Test
    fun marksAllRequiredFieldsWhenEmpty() {
        val result = VentaValidator.validate("", "", "", null)

        assertFalse(result.isValid)
        assertEquals(VentaField.entries.toSet(), result.errors.keys)
    }

    @Test
    fun rejectsMalformedProductPriceAndQuantity() {
        val result = VentaValidator.validate(
            productId = "producto",
            unitPrice = "abc",
            quantity = "1.5",
            dateMillis = validDate
        )

        assertEquals("Usa el formato del catálogo: de 1 a 3 letras y 3 números.", result.errors[VentaField.ProductId])
        assertEquals("Ingresa un precio válido.", result.errors[VentaField.UnitPrice])
        assertEquals("Ingresa una cantidad entera.", result.errors[VentaField.Quantity])
    }

    @Test
    fun rejectsNonPositiveAndOutOfRangeValues() {
        val result = VentaValidator.validate("B003", "0", "10001", validDate)

        assertEquals("El precio debe ser mayor que cero.", result.errors[VentaField.UnitPrice])
        assertEquals("La cantidad debe estar entre 1 y 10,000.", result.errors[VentaField.Quantity])
    }

    @Test
    fun acceptsValidSaleFieldsAndDecimalComma() {
        val result = VentaValidator.validate("b003", "10,50", "2", validDate)

        assertTrue(result.isValid)
    }

    @Test
    fun rejectsFutureAndTooOldDates() {
        val future = LocalDate.now(ZoneOffset.UTC).plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
        val old = LocalDate.of(1999, 12, 31).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()

        assertTrue(VentaValidator.validate("B003", "10", "1", future).errors.containsKey(VentaField.Date))
        assertTrue(VentaValidator.validate("B003", "10", "1", old).errors.containsKey(VentaField.Date))
    }
}
