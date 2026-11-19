package com.proyectorenefull.app.data.auth

import com.proyectorenefull.app.data.remote.ApiCallResult
import com.proyectorenefull.app.data.remote.ApiErrorMapper
import com.proyectorenefull.app.data.remote.ClienteApi
import com.proyectorenefull.app.data.session.SessionStore
import com.proyectorenefull.app.data.session.StoredSession
import com.proyectorenefull.app.model.auth.AccountRole
import com.proyectorenefull.app.model.auth.AuthCredentials
import com.proyectorenefull.app.model.auth.AuthFailure
import com.proyectorenefull.app.model.auth.AuthRepository
import com.proyectorenefull.app.model.auth.LoginResult
import com.proyectorenefull.app.model.auth.RegistrationCredentials
import com.proyectorenefull.app.model.auth.RegistrationResult
import com.proyectorenefull.app.model.auth.SessionRestoreResult
import org.json.JSONObject

class ApiAuthRepository(
    private val api: ClienteApi,
    private val sessionStore: SessionStore
) : AuthRepository {
    override fun login(credentials: AuthCredentials, onResult: (LoginResult) -> Unit) {
        val body = JSONObject()
            .put("email", credentials.email.trim())
            .put("password", credentials.password)
        api.request("POST", "/api/auth/login", body, requiresAuth = false) { result ->
            val response = result as? ApiCallResult.Response
            val role = response?.body?.optJSONObject("usuario")?.accountRole()
            val token = response?.body?.optString("token")
            if (response?.status == 200 && role != null && !token.isNullOrBlank()) {
                sessionStore.save(token, role)
                onResult(LoginResult.Success(role))
            } else {
                val failure = ApiErrorMapper.authFailure(result, loginRequest = true)
                onResult(failure.toLoginResult())
            }
        }
    }

    override fun register(
        credentials: RegistrationCredentials,
        onResult: (RegistrationResult) -> Unit
    ) {
        val body = JSONObject()
            .put("nombre", credentials.name.trim())
            .put("email", credentials.email.trim())
            .put("password", credentials.password)
        api.request("POST", "/api/auth/registro", body, requiresAuth = false) { result ->
            val response = result as? ApiCallResult.Response
            val role = response?.body?.optJSONObject("usuario")?.accountRole()
            val token = response?.body?.optString("token")
            if (response?.status == 201 && role != null && !token.isNullOrBlank()) {
                sessionStore.save(token, role)
                onResult(RegistrationResult.Success(role))
            } else {
                val failure = ApiErrorMapper.authFailure(result)
                onResult(failure.toRegistrationResult())
            }
        }
    }

    override fun restoreSession(onResult: (SessionRestoreResult) -> Unit) {
        when (sessionStore.restore()) {
            StoredSession.Missing -> onResult(SessionRestoreResult.NoSession)
            StoredSession.Expired -> onResult(SessionRestoreResult.Failure(AuthFailure.SessionExpired))
            is StoredSession.Active -> api.request("GET", "/api/auth/me") { result ->
                val response = result as? ApiCallResult.Response
                val role = response?.body?.optJSONObject("usuario")?.accountRole()
                if (response?.status == 200 && role != null) {
                    sessionStore.updateRole(role)
                    onResult(SessionRestoreResult.Authenticated(role))
                } else {
                    val failure = ApiErrorMapper.authFailure(result)
                    if (failure.reason == AuthFailure.SessionExpired) {
                        sessionStore.clear()
                    }
                    onResult(SessionRestoreResult.Failure(failure.reason))
                }
            }
        }
    }

    override fun logout() {
        sessionStore.clear()
    }

    private fun JSONObject.accountRole(): AccountRole? = when (optString("rol")) {
        "cliente" -> AccountRole.Client
        "administrador" -> AccountRole.Administrator
        else -> null
    }

    private fun com.proyectorenefull.app.data.remote.AuthApiFailure.toLoginResult() =
        LoginResult.Failure(
            reason = reason,
            nameError = fields["nombre"],
            emailError = fields["email"],
            passwordError = fields["password"]
        )

    private fun com.proyectorenefull.app.data.remote.AuthApiFailure.toRegistrationResult() =
        RegistrationResult.Failure(
            reason = reason,
            nameError = fields["nombre"],
            emailError = fields["email"],
            passwordError = fields["password"]
        )
}
