package com.proyectorenefull.app.ui

import com.proyectorenefull.app.validation.VentaField
import com.proyectorenefull.app.domain.auth.AccountRole
import com.proyectorenefull.app.domain.auth.AuthCredentials
import com.proyectorenefull.app.domain.auth.AuthFailure
import com.proyectorenefull.app.domain.auth.AuthRepository
import com.proyectorenefull.app.domain.auth.LoginResult
import com.proyectorenefull.app.domain.auth.RegistrationResult
import com.proyectorenefull.app.data.client.UnavailableClientRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class PrototypeViewModelTest {
    @Test
    fun loginValidationReportsRequiredFields() {
        val repository = FakeAuthRepository()
        val viewModel = AuthViewModel(repository)

        viewModel.submitLogin()

        assertNotNull(viewModel.state.value.emailError)
        assertNotNull(viewModel.state.value.passwordError)
        assertEquals(null, viewModel.state.value.feedback)
        assertEquals(false, repository.loginCalled)
    }

    @Test
    fun validLoginUsesTheRepositoryResult() {
        val viewModel = AuthViewModel(FakeAuthRepository())
        viewModel.updateEmail("persona@example.com")
        viewModel.updatePassword("clave")

        viewModel.submitLogin()

        assertEquals(AccountRole.Client, viewModel.state.value.authenticatedRole)
        assertEquals(true, viewModel.state.value.isPreviewSession)
        assertEquals(null, viewModel.state.value.emailError)
        assertEquals(null, viewModel.state.value.passwordError)
        assertEquals("", viewModel.state.value.password)
    }

    @Test
    fun asynchronousRepositoryKeepsTheFormInLoadingState() {
        val repository = FakeAuthRepository(completeLogin = false)
        val viewModel = AuthViewModel(repository)
        viewModel.updateEmail("persona@example.com")
        viewModel.updatePassword("clave")

        viewModel.submitLogin()

        assertEquals(true, viewModel.state.value.isSubmitting)
        assertEquals(true, repository.loginCalled)
    }

    @Test
    fun loginFailureShowsCredentialMessageAndClearsPassword() {
        val viewModel = AuthViewModel(
            FakeAuthRepository(loginResult = LoginResult.Failure(AuthFailure.InvalidCredentials))
        )
        viewModel.updateEmail("persona@example.com")
        viewModel.updatePassword("clave")

        viewModel.submitLogin()

        assertEquals("", viewModel.state.value.password)
        assertEquals("El correo o la contraseña no son correctos.", viewModel.state.value.feedback?.message)
        assertEquals(false, viewModel.state.value.isSubmitting)
    }

    @Test
    fun registrationConflictIsExplainedWithoutCreatingAnAccount() {
        val viewModel = AuthViewModel(
            FakeAuthRepository(
                registrationResult = RegistrationResult.Failure(AuthFailure.Conflict)
            )
        )
        viewModel.updateEmail("persona@example.com")
        viewModel.updatePassword("clave")

        viewModel.submitRegistration()

        assertEquals("Ya existe una cuenta con esos datos.", viewModel.state.value.feedback?.message)
        assertEquals(null, viewModel.state.value.authenticatedRole)
    }

    @Test
    fun serverFailureUsesAGenericMessage() {
        val viewModel = AuthViewModel(FakeAuthRepository())

        viewModel.onLoginFailed(AuthFailure.Server)

        assertEquals("No se pudo completar la solicitud. Inténtalo más tarde.", viewModel.state.value.feedback?.message)
    }

    @Test
    fun registrationPreviewNeverChoosesAnAdministratorRole() {
        val viewModel = AuthViewModel(FakeAuthRepository())
        viewModel.updateEmail("persona@example.com")
        viewModel.updatePassword("clave")

        viewModel.submitRegistration()

        assertEquals(null, viewModel.state.value.authenticatedRole)
        assertEquals(false, viewModel.state.value.isPreviewSession)
        assertEquals("Registro simulado; no se creó una cuenta real.", viewModel.state.value.feedback?.message)
    }

    @Test
    fun sessionExpiredAndConnectionFailuresHaveSeparateMessages() {
        val viewModel = AuthViewModel(FakeAuthRepository())
        viewModel.onLoginFailed(AuthFailure.SessionExpired)
        assertEquals("La sesión venció. Inicia sesión de nuevo.", viewModel.state.value.feedback?.message)

        viewModel.onLoginFailed(AuthFailure.Network)
        assertEquals("No hay conexión. Revisa la red e inténtalo de nuevo.", viewModel.state.value.feedback?.message)
    }

    @Test
    fun serverValidationCanPointToFields() {
        val viewModel = AuthViewModel(FakeAuthRepository())
        viewModel.onLoginStarted()

        viewModel.onFieldValidationFailed(
            emailError = "Revisa el correo.",
            passwordError = "La contraseña no cumple el formato requerido."
        )

        assertEquals("Revisa el correo.", viewModel.state.value.emailError)
        assertEquals("La contraseña no cumple el formato requerido.", viewModel.state.value.passwordError)
        assertEquals(false, viewModel.state.value.isSubmitting)
    }

    @Test
    fun authenticationResultCarriesServerRoleWithoutFormRoleSelection() {
        val viewModel = AuthViewModel(FakeAuthRepository())
        viewModel.onLoginStarted()

        viewModel.onLoginSucceeded(AccountRole.Administrator, isPreview = false)

        assertEquals(AccountRole.Administrator, viewModel.state.value.authenticatedRole)
        assertEquals(false, viewModel.state.value.isSubmitting)
        assertEquals("", viewModel.state.value.password)
    }

    @Test
    fun validSaleReportsUnavailableServiceWithoutStoring() {
        val viewModel = VentaFormViewModel(UnavailableClientRepository())
        viewModel.updateProduct("Producto")
        viewModel.updateCategory("Categoría")
        viewModel.updateUnitPrice("12.50")
        viewModel.updateQuantity("3")
        viewModel.updateDate(1L)

        viewModel.submit()

        assertEquals(emptyMap<VentaField, String>(), viewModel.state.value.errors)
        assertEquals("El servicio de ventas no está disponible. No se guardó la venta.", viewModel.state.value.message)
    }
}

private class FakeAuthRepository(
    private val loginResult: LoginResult = LoginResult.Success(AccountRole.Client, isPreview = true),
    private val registrationResult: RegistrationResult = RegistrationResult.Success(isPreview = true),
    private val completeLogin: Boolean = true
) : AuthRepository {
    var loginCalled = false
        private set

    override fun login(credentials: AuthCredentials, onResult: (LoginResult) -> Unit) {
        loginCalled = true
        if (completeLogin) onResult(loginResult)
    }

    override fun register(credentials: AuthCredentials, onResult: (RegistrationResult) -> Unit) {
        onResult(registrationResult)
    }
}
