package com.proyectorenefull.app.data.auth

import com.proyectorenefull.app.domain.auth.AccountRole
import com.proyectorenefull.app.domain.auth.AuthCredentials
import com.proyectorenefull.app.domain.auth.AuthFailure
import com.proyectorenefull.app.domain.auth.AuthRepository
import com.proyectorenefull.app.domain.auth.LoginResult
import com.proyectorenefull.app.domain.auth.RegistrationResult

object AuthRepositoryFactory {
    fun create(): AuthRepository = DebugAuthRepository()
}

private class DebugAuthRepository : AuthRepository {
    override fun login(credentials: AuthCredentials, onResult: (LoginResult) -> Unit) {
        val result = when (credentials.email.trim().lowercase()) {
            "incorrecto@demo.test" -> LoginResult.Failure(AuthFailure.InvalidCredentials)
            "sinred@demo.test" -> LoginResult.Failure(AuthFailure.Network)
            "servidor@demo.test" -> LoginResult.Failure(AuthFailure.Server)
            "sinpermiso@demo.test" -> LoginResult.Failure(AuthFailure.Forbidden)
            else -> LoginResult.Success(AccountRole.Client, isPreview = true)
        }
        onResult(result)
    }

    override fun register(credentials: AuthCredentials, onResult: (RegistrationResult) -> Unit) {
        val result = if (credentials.email.trim().equals("duplicado@demo.test", ignoreCase = true)) {
            RegistrationResult.Failure(AuthFailure.Conflict)
        } else {
            RegistrationResult.Success(isPreview = true)
        }
        onResult(result)
    }
}
