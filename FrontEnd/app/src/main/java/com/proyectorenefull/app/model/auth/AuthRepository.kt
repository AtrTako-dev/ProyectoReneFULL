package com.proyectorenefull.app.model.auth

interface AuthRepository {
    fun login(credentials: AuthCredentials, onResult: (LoginResult) -> Unit)
    fun register(credentials: RegistrationCredentials, onResult: (RegistrationResult) -> Unit)
    fun restoreSession(onResult: (SessionRestoreResult) -> Unit)
    fun logout()
}
