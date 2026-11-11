package com.proyectorenefull.app.data.auth

import com.proyectorenefull.app.domain.auth.AuthCredentials
import com.proyectorenefull.app.domain.auth.AuthFailure
import com.proyectorenefull.app.domain.auth.AuthRepository
import com.proyectorenefull.app.domain.auth.LoginResult
import com.proyectorenefull.app.domain.auth.RegistrationResult

object AuthRepositoryFactory {
    fun create(): AuthRepository = UnavailableAuthRepository()
}

private class UnavailableAuthRepository : AuthRepository {
    override fun login(credentials: AuthCredentials, onResult: (LoginResult) -> Unit) {
        onResult(LoginResult.Failure(AuthFailure.ServiceUnavailable))
    }

    override fun register(credentials: AuthCredentials, onResult: (RegistrationResult) -> Unit) {
        onResult(RegistrationResult.Failure(AuthFailure.ServiceUnavailable))
    }
}
