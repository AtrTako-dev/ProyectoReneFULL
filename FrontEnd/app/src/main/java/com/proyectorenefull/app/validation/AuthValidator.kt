package com.proyectorenefull.app.validation

object AuthValidator {
    private val emailPattern = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")

    fun validateName(name: String): String? = when {
        name.isBlank() -> "Ingresa tu nombre."
        name.trim().length > 120 -> "El nombre no puede superar 120 caracteres."
        else -> null
    }

    fun validateEmail(email: String): String? = when {
        email.isBlank() -> "Ingresa tu correo electrónico."
        email.trim().length > 254 -> "El correo no puede superar 254 caracteres."
        !emailPattern.matches(email.trim()) -> "Ingresa un correo electrónico válido."
        else -> null
    }

    fun validatePassword(password: String): String? = when {
        password.isBlank() -> "Ingresa tu contraseña."
        password.length < 8 -> "La contraseña debe tener al menos 8 caracteres."
        password.length > 128 -> "La contraseña no puede superar 128 caracteres."
        else -> null
    }
}
