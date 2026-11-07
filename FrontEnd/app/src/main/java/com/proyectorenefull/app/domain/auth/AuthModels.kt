package com.proyectorenefull.app.domain.auth

enum class AccountRole {
    Client,
    Administrator
}

enum class AuthFailure {
    InvalidCredentials,
    SessionExpired,
    ValidationRejected,
    Forbidden,
    Conflict,
    Network,
    Server,
    ServiceUnavailable,
    Unknown
}

data class AuthFeedback(
    val message: String,
    val isError: Boolean
)

fun AuthFailure.toFeedback(): AuthFeedback = when (this) {
    AuthFailure.InvalidCredentials -> AuthFeedback("El correo o la contraseña no son correctos.", true)
    AuthFailure.SessionExpired -> AuthFeedback("La sesión venció. Inicia sesión de nuevo.", true)
    AuthFailure.ValidationRejected -> AuthFeedback("Revisa los datos del formulario.", true)
    AuthFailure.Forbidden -> AuthFeedback("La cuenta no tiene permiso para realizar esta acción.", true)
    AuthFailure.Conflict -> AuthFeedback("Ya existe una cuenta con esos datos.", true)
    AuthFailure.Network -> AuthFeedback("No hay conexión. Revisa la red e inténtalo de nuevo.", true)
    AuthFailure.Server -> AuthFeedback("No se pudo completar la solicitud. Inténtalo más tarde.", true)
    AuthFailure.ServiceUnavailable -> AuthFeedback("El servicio de autenticación no está conectado.", true)
    AuthFailure.Unknown -> AuthFeedback("Ocurrió un error al procesar la solicitud.", true)
}

data class AuthCredentials(
    val email: String,
    val password: String
)

sealed interface LoginResult {
    data class Success(
        val role: AccountRole,
        val isPreview: Boolean
    ) : LoginResult

    data class Failure(
        val reason: AuthFailure,
        val emailError: String? = null,
        val passwordError: String? = null
    ) : LoginResult
}

sealed interface RegistrationResult {
    data class Success(val isPreview: Boolean) : RegistrationResult
    data class Failure(
        val reason: AuthFailure,
        val emailError: String? = null,
        val passwordError: String? = null
    ) : RegistrationResult
}
