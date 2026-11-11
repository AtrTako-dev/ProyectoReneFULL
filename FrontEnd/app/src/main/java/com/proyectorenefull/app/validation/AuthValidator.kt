package com.proyectorenefull.app.validation

object AuthValidator {
    private val emailPattern = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")

    fun validateEmail(email: String): String? = when {
        email.isBlank() -> "Ingresa tu correo electrónico."
        !emailPattern.matches(email.trim()) -> "Ingresa un correo electrónico válido."
        else -> null
    }

    fun validatePassword(password: String): String? =
        if (password.isBlank()) "Ingresa tu contraseña." else null
}
