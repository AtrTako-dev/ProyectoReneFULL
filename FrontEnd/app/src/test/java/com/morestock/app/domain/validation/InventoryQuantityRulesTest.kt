package com.morestock.app.domain.validation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class InventoryQuantityValidationTest {
    @Test
    fun acceptsDecimalQuantitiesForMeasuredUnits() {
        assertEquals(12.5, requireNotNull(InventoryQuantityRules.parse("12,5", "kg")), 0.0)
        assertEquals(0.125, requireNotNull(InventoryQuantityRules.parse("0.125", "litro")), 0.0)
        assertNull(InventoryQuantityRules.error("12,5", "kg"))
    }

    @Test
    fun rejectsEmptyNegativeMalformedAndOverPreciseValues() {
        assertEquals("Escribe una cantidad.", InventoryQuantityRules.error("  ", "kg"))
        assertEquals("La cantidad no puede ser negativa.", InventoryQuantityRules.error("-2", "kg"))
        assertEquals("Usa un número válido con hasta tres decimales.", InventoryQuantityRules.error("1.2345", "kg"))
        assertEquals("Usa un número válido con hasta tres decimales.", InventoryQuantityRules.error("12.", "kg"))
        assertNull(InventoryQuantityRules.parse("-2", "kg"))
    }

    @Test
    fun wholeUnitsRejectFractions() {
        assertEquals("Para pieza, usa una cantidad entera sin decimales.", InventoryQuantityRules.error("1.5", "pieza"))
        assertEquals(12.0, requireNotNull(InventoryQuantityRules.parse("12", "caja")), 0.0)
        assertNull(InventoryQuantityRules.parse("1,5", "pieza"))
        assertEquals("Para piezas, usa una cantidad entera sin decimales.", InventoryQuantityRules.error(2.5, "piezas"))
    }
}
