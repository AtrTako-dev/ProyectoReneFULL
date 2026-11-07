package com.proyectorenefull.app.data.auth

import com.proyectorenefull.app.domain.auth.AuthCredentials
import com.proyectorenefull.app.domain.auth.AuthFailure
import com.proyectorenefull.app.domain.auth.AccountRole
import com.proyectorenefull.app.domain.auth.LoginResult
import com.proyectorenefull.app.domain.auth.RegistrationResult
import org.junit.Assert.assertEquals
import org.junit.Test

class DebugAuthRepositoryTest {
    private val repository = AuthRepositoryFactory.create()

    @Test
    fun regularLoginReturnsOnlyASimulatedClientSession() {
        var result: LoginResult? = null

        repository.login(AuthCredentials("cliente@demo.test", "demo")) { result = it }

        assertEquals(LoginResult.Success(AccountRole.Client, true), result)
    }

    @Test
    fun reservedDemoAddressCanExerciseCredentialError() {
        var result: LoginResult? = null

        repository.login(AuthCredentials("incorrecto@demo.test", "demo")) { result = it }

        assertEquals(LoginResult.Failure(AuthFailure.InvalidCredentials), result)
    }

    @Test
    fun networkAndServerFailuresCanBePreviewedWithoutCallingAnApi() {
        var networkResult: LoginResult? = null
        var serverResult: LoginResult? = null

        repository.login(AuthCredentials("sinred@demo.test", "demo")) { networkResult = it }
        repository.login(AuthCredentials("servidor@demo.test", "demo")) { serverResult = it }

        assertEquals(LoginResult.Failure(AuthFailure.Network), networkResult)
        assertEquals(LoginResult.Failure(AuthFailure.Server), serverResult)
    }

    @Test
    fun registrationPreviewDoesNotCreateARealAccount() {
        var result: RegistrationResult? = null

        repository.register(AuthCredentials("persona@demo.test", "demo")) { result = it }

        assertEquals(RegistrationResult.Success(isPreview = true), result)
    }

    @Test
    fun duplicateRegistrationAddressReturnsConflict() {
        var result: RegistrationResult? = null

        repository.register(AuthCredentials("duplicado@demo.test", "demo")) { result = it }

        assertEquals(RegistrationResult.Failure(AuthFailure.Conflict), result)
    }
}
