package com.morestock.app.ui.validation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AuthFormValidationTest {
    @Test
    fun emailMustMatchTheExistingApiContract() {
        assertNull(AuthFormValidation.emailError(" tienda@example.com "))
        assertEquals("Escribe un correo electrónico válido.", AuthFormValidation.emailError("tienda"))
    }

    @Test
    fun passwordMustContainAtLeastEightUnicodeCharacters() {
        assertEquals("La contraseña debe tener al menos 8 caracteres.", AuthFormValidation.passwordError("abc123"))
        assertNull(AuthFormValidation.passwordError("abc12345"))
    }

    @Test
    fun loginOnlyRequiresANonEmptyPassword() {
        assertEquals("Escribe tu contraseña.", AuthFormValidation.loginPasswordError("   "))
        assertNull(AuthFormValidation.loginPasswordError("abc123"))
    }

    @Test
    fun businessNameMustContainBetweenOneAndOneHundredFiftyCharacters() {
        assertEquals("Escribe el nombre de tu negocio.", AuthFormValidation.businessNameError("   "))
        assertEquals(
            "El nombre puede tener hasta 150 caracteres.",
            AuthFormValidation.businessNameError("a".repeat(151)),
        )
        assertNull(AuthFormValidation.businessNameError("  Mi tienda  "))
    }
}
