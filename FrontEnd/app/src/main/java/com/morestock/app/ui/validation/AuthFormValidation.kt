package com.morestock.app.ui.validation

object AuthFormValidation {
    private val emailPattern = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")

    fun emailError(value: String): String? {
        val email = value.trim()
        return when {
            email.isEmpty() || email.length > 254 || !emailPattern.matches(email) ->
                "Escribe un correo electrónico válido."
            else -> null
        }
    }

    fun passwordError(value: String): String? =
        if (value.codePointCount(0, value.length) < 8) {
            "La contraseña debe tener al menos 8 caracteres."
        } else {
            null
        }

    fun loginPasswordError(value: String): String? =
        if (value.isBlank()) "Escribe tu contraseña." else null

    fun businessNameError(value: String): String? {
        val name = value.trim()
        val length = name.codePointCount(0, name.length)
        return when {
            length == 0 -> "Escribe el nombre de tu negocio."
            length > 150 -> "El nombre puede tener hasta 150 caracteres."
            else -> null
        }
    }
}
