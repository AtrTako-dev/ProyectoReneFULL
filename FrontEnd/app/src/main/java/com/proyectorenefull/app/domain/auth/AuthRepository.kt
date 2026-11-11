package com.proyectorenefull.app.domain.auth

interface AuthRepository {
    fun login(credentials: AuthCredentials, onResult: (LoginResult) -> Unit)

    fun register(credentials: AuthCredentials, onResult: (RegistrationResult) -> Unit)
}
