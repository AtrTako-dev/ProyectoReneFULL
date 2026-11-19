package com.proyectorenefull.app.data.remote

import com.proyectorenefull.app.model.auth.AuthFailure
import com.proyectorenefull.app.model.client.ClientResult
import org.json.JSONObject

data class AuthApiFailure(
    val reason: AuthFailure,
    val fields: Map<String, String> = emptyMap()
)

object ApiErrorMapper {
    fun authFailure(result: ApiCallResult, loginRequest: Boolean = false): AuthApiFailure = when (result) {
        ApiCallResult.NetworkFailure -> AuthApiFailure(AuthFailure.Network)
        is ApiCallResult.Response -> {
            val fields = result.body?.errorFields().orEmpty()
            val reason = when (result.status) {
                400, 422 -> AuthFailure.ValidationRejected
                401 -> if (loginRequest) AuthFailure.InvalidCredentials else AuthFailure.SessionExpired
                403 -> AuthFailure.Forbidden
                404 -> AuthFailure.NotFound
                409 -> AuthFailure.Conflict
                in 500..599 -> AuthFailure.Server
                else -> AuthFailure.Unknown
            }
            AuthApiFailure(reason, fields)
        }
    }

    fun clientFailure(result: ApiCallResult): ClientResult.Failure = when (result) {
        ApiCallResult.NetworkFailure -> ClientResult.Failure(
            message = "No hay conexión. Revisa la red e inténtalo de nuevo."
        )
        is ApiCallResult.Response -> when (result.status) {
            400, 422 -> ClientResult.Failure(
                message = result.body?.errorMessage() ?: "Revisa los campos indicados.",
                fieldErrors = result.body?.errorFields().orEmpty()
            )
            401 -> ClientResult.Failure(
                message = "La sesión venció. Inicia sesión de nuevo.",
                requiresLogin = true
            )
            403 -> ClientResult.Failure("La cuenta no tiene permiso para realizar esta acción.")
            404 -> ClientResult.Failure("El producto o recurso solicitado ya no está disponible.")
            409 -> ClientResult.Failure(
                result.body?.errorMessage() ?: "La operación entra en conflicto con los datos existentes."
            )
            in 500..599 -> ClientResult.Failure(
                "El servidor no pudo completar la solicitud. Inténtalo más tarde."
            )
            else -> ClientResult.Failure("Ocurrió un error al procesar la solicitud.")
        }
    }

    private fun JSONObject.errorFields(): Map<String, String> {
        val fields = optJSONObject("error")?.optJSONObject("campos") ?: return emptyMap()
        return fields.keys().asSequence().associateWith { key -> fields.optString(key) }
    }

    private fun JSONObject.errorMessage(): String? =
        optJSONObject("error")?.optString("mensaje")?.takeIf { it.isNotBlank() }
}
