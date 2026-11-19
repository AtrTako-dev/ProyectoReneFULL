package com.proyectorenefull.app.model.auth

enum class AccountRole {
    Client,
    Administrator
}

enum class AuthFailure {
    InvalidCredentials,
    SessionExpired,
    ValidationRejected,
    Forbidden,
    NotFound,
    Conflict,
    Network,
    Server,
    Unknown
}

data class AuthFeedback(val message: String, val isError: Boolean)

fun AuthFailure.toFeedback(): AuthFeedback = when (this) {
    AuthFailure.InvalidCredentials -> AuthFeedback("El correo o la contraseña no son correctos.", true)
    AuthFailure.SessionExpired -> AuthFeedback("La sesión venció. Inicia sesión de nuevo.", true)
    AuthFailure.ValidationRejected -> AuthFeedback("Revisa los campos indicados.", true)
    AuthFailure.Forbidden -> AuthFeedback("La cuenta no tiene permiso para realizar esta acción.", true)
    AuthFailure.NotFound -> AuthFeedback("El recurso solicitado ya no está disponible.", true)
    AuthFailure.Conflict -> AuthFeedback("Ya existe una cuenta con esos datos.", true)
    AuthFailure.Network -> AuthFeedback("No hay conexión. Revisa la red e inténtalo de nuevo.", true)
    AuthFailure.Server -> AuthFeedback("El servidor no pudo completar la solicitud. Inténtalo más tarde.", true)
    AuthFailure.Unknown -> AuthFeedback("Ocurrió un error al procesar la solicitud.", true)
}

data class AuthCredentials(val email: String, val password: String)

data class RegistrationCredentials(
    val name: String,
    val email: String,
    val password: String
)

sealed interface SessionRestoreResult {
    data object NoSession : SessionRestoreResult
    data class Authenticated(val role: AccountRole) : SessionRestoreResult
    data class Failure(val reason: AuthFailure) : SessionRestoreResult
}

sealed interface LoginResult {
    data class Success(val role: AccountRole) : LoginResult
    data class Failure(
        val reason: AuthFailure,
        val nameError: String? = null,
        val emailError: String? = null,
        val passwordError: String? = null
    ) : LoginResult
}

sealed interface RegistrationResult {
    data class Success(val role: AccountRole) : RegistrationResult
    data class Failure(
        val reason: AuthFailure,
        val nameError: String? = null,
        val emailError: String? = null,
        val passwordError: String? = null
    ) : RegistrationResult
}
