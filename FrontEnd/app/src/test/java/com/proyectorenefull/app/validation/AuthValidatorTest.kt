package com.proyectorenefull.app.validation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AuthValidatorTest {
    @Test
    fun rejectsBlankAndMalformedEmail() {
        assertEquals("Ingresa tu correo electrónico.", AuthValidator.validateEmail(" "))
        assertEquals("Ingresa un correo electrónico válido.", AuthValidator.validateEmail("correo-invalido"))
    }

    @Test
    fun acceptsWellFormedEmailAndNonEmptyPassword() {
        assertNull(AuthValidator.validateEmail("persona@example.com"))
        assertNull(AuthValidator.validatePassword("contraseña"))
    }

    @Test
    fun rejectsBlankPassword() {
        assertEquals("Ingresa tu contraseña.", AuthValidator.validatePassword(""))
    }
}
