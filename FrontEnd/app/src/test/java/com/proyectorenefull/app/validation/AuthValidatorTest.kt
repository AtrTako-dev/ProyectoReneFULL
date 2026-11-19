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
        assertNull(AuthValidator.validatePassword("contraseña-segura"))
    }

    @Test
    fun rejectsBlankPassword() {
        assertEquals("Ingresa tu contraseña.", AuthValidator.validatePassword(""))
    }

    @Test
    fun validatesRegistrationNameAndContractLimits() {
        assertEquals("Ingresa tu nombre.", AuthValidator.validateName(" "))
        assertNull(AuthValidator.validateName("Cliente Uno"))
        assertEquals("El nombre no puede superar 120 caracteres.", AuthValidator.validateName("x".repeat(121)))
        assertEquals("El correo no puede superar 254 caracteres.", AuthValidator.validateEmail("a".repeat(250) + "@x.co"))
        assertEquals("La contraseña debe tener al menos 8 caracteres.", AuthValidator.validatePassword("1234567"))
        assertEquals("La contraseña no puede superar 128 caracteres.", AuthValidator.validatePassword("x".repeat(129)))
    }
}
