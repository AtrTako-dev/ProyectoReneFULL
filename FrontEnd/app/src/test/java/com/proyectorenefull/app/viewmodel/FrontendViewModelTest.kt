package com.proyectorenefull.app.viewmodel

import com.proyectorenefull.app.model.admin.AdminRepository
import com.proyectorenefull.app.model.admin.AdminStatistics
import com.proyectorenefull.app.model.admin.AdminUser
import com.proyectorenefull.app.model.auth.AccountRole
import com.proyectorenefull.app.model.auth.AuthCredentials
import com.proyectorenefull.app.model.auth.AuthFailure
import com.proyectorenefull.app.model.auth.AuthRepository
import com.proyectorenefull.app.model.auth.LoginResult
import com.proyectorenefull.app.model.auth.RegistrationCredentials
import com.proyectorenefull.app.model.auth.RegistrationResult
import com.proyectorenefull.app.model.auth.SessionRestoreResult
import com.proyectorenefull.app.model.client.ClientInsights
import com.proyectorenefull.app.model.client.ClientRepository
import com.proyectorenefull.app.model.client.ClientResult
import com.proyectorenefull.app.model.client.SaleDraft
import com.proyectorenefull.app.model.client.SaleRecord
import com.proyectorenefull.app.validation.VentaField
import java.math.BigDecimal
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FrontendViewModelTest {
    @Test
    fun loginValidationRejectsMissingCredentialsBeforeCallingRepository() {
        val repository = FakeAuthRepository()
        val viewModel = AuthViewModel(repository)

        viewModel.submitLogin()

        assertNotNull(viewModel.state.value.emailError)
        assertNotNull(viewModel.state.value.passwordError)
        assertFalse(repository.loginCalled)
    }

    @Test
    fun successfulLoginUsesTheRoleReturnedByRepository() {
        val viewModel = AuthViewModel(
            FakeAuthRepository(loginResult = LoginResult.Success(AccountRole.Administrator))
        )
        viewModel.updateEmail("admin@example.com")
        viewModel.updatePassword("clave-segura")

        viewModel.submitLogin()

        assertEquals(AccountRole.Administrator, viewModel.state.value.authenticatedRole)
        assertEquals("", viewModel.state.value.password)
    }

    @Test
    fun registrationRequiresNameAndSendsOnlyNameEmailAndPassword() {
        val repository = FakeAuthRepository()
        val viewModel = AuthViewModel(repository)
        viewModel.updateEmail("cliente@example.com")
        viewModel.updatePassword("clave-segura")
        viewModel.submitRegistration()
        assertFalse(repository.registrationCalled)

        viewModel.updateName("Cliente Uno")
        viewModel.submitRegistration()

        assertEquals(RegistrationCredentials("Cliente Uno", "cliente@example.com", "clave-segura"), repository.registrationCredentials)
        assertEquals(AccountRole.Client, viewModel.state.value.authenticatedRole)
    }

    @Test
    fun repositoryFieldErrorsAreShownOnTheForm() {
        val viewModel = AuthViewModel(
            FakeAuthRepository(
                loginResult = LoginResult.Failure(
                    reason = AuthFailure.ValidationRejected,
                    emailError = "El correo no está disponible."
                )
            )
        )
        viewModel.updateEmail("cliente@example.com")
        viewModel.updatePassword("clave-segura")

        viewModel.submitLogin()

        assertEquals("El correo no está disponible.", viewModel.state.value.emailError)
        assertFalse(viewModel.state.value.isSubmitting)
    }

    @Test
    fun loginFailureExplainsIncorrectCredentialsAndNetworkProblems() {
        val viewModel = AuthViewModel(FakeAuthRepository(loginResult = LoginResult.Failure(AuthFailure.InvalidCredentials)))
        viewModel.updateEmail("cliente@example.com")
        viewModel.updatePassword("clave-segura")
        viewModel.submitLogin()
        assertEquals("El correo o la contraseña no son correctos.", viewModel.state.value.feedback?.message)

        viewModel.onLoginFailed(AuthFailure.Network)
        assertEquals("No hay conexión. Revisa la red e inténtalo de nuevo.", viewModel.state.value.feedback?.message)
    }

    @Test
    fun pendingLoginKeepsLoadingUntilRepositoryResponds() {
        val repository = FakeAuthRepository(completeLogin = false)
        val viewModel = AuthViewModel(repository)
        viewModel.updateEmail("cliente@example.com")
        viewModel.updatePassword("clave-segura")

        viewModel.submitLogin()

        assertTrue(viewModel.state.value.isSubmitting)
        assertTrue(repository.loginCalled)
    }

    @Test
    fun logoutCallsRepositoryAndClearsAuthenticationState() {
        val repository = FakeAuthRepository()
        val viewModel = AuthViewModel(repository)
        viewModel.onLoginSucceeded(AccountRole.Client)

        viewModel.logout()

        assertTrue(repository.logoutCalled)
        assertNull(viewModel.state.value.authenticatedRole)
    }

    @Test
    fun ownSalesDistinguishesEmptySuccessFromForbiddenAndExpiredSession() {
        val repository = FakeClientRepository(salesResult = ClientResult.Success(emptyList()))
        val viewModel = ClientViewModel(repository)
        viewModel.loadOwnSales()
        assertEquals(ClientScreenState.Empty, viewModel.sales.value)

        repository.salesResult = ClientResult.Failure("La cuenta no tiene permiso para realizar esta acción.")
        viewModel.loadOwnSales()
        assertEquals(
            "La cuenta no tiene permiso para realizar esta acción.",
            (viewModel.sales.value as ClientScreenState.Error).message
        )
        assertFalse(viewModel.sessionExpired.value)

        repository.salesResult = ClientResult.Failure("La sesión venció.", requiresLogin = true)
        viewModel.loadOwnSales()
        assertTrue(viewModel.sessionExpired.value)
    }

    @Test
    fun saleRetryKeepsSameIdempotencyKeyAfterNetworkFailure() {
        val repository = FakeClientRepository()
        val viewModel = VentaFormViewModel(repository)
        viewModel.updateProductId("B003")
        viewModel.updateUnitPrice("12.50")
        viewModel.updateQuantity("3")
        viewModel.updateDate(1_780_272_000_000L)

        repository.createSaleResult = ClientResult.Failure("No hay conexión.")
        viewModel.submit()
        val firstKey = repository.submittedSales.single().idempotencyKey
        assertEquals("No hay conexión.", viewModel.state.value.message)

        repository.createSaleResult = ClientResult.Success(Unit)
        viewModel.submit()

        assertEquals(firstKey, repository.submittedSales.last().idempotencyKey)
        assertEquals("Venta registrada.", viewModel.state.value.message)
        assertTrue(viewModel.state.value.productId.isEmpty())
    }

    @Test
    fun saleFieldsAreValidatedAndMapServerFieldErrors() {
        val repository = FakeClientRepository()
        val viewModel = VentaFormViewModel(repository)
        viewModel.submit()
        assertEquals(VentaField.entries.toSet(), viewModel.state.value.errors.keys)
        assertTrue(repository.submittedSales.isEmpty())

        viewModel.updateProductId("B003")
        viewModel.updateUnitPrice("12")
        viewModel.updateQuantity("1")
        viewModel.updateDate(1_780_272_000_000L)
        repository.createSaleResult = ClientResult.Failure(
            "Corrige el producto.",
            fieldErrors = mapOf("producto_id" to "El producto no existe.")
        )
        viewModel.submit()
        assertEquals("El producto no existe.", viewModel.state.value.errors[VentaField.ProductId])
    }

    @Test
    fun adminStatisticsExposeServerCategoriesAndRoleChangeUsesReturnedUser() {
        val categories = listOf(
            com.proyectorenefull.app.model.admin.AdminCategoryStatistic(
                "Bebidas", 4, 7, BigDecimal("125.50")
            )
        )
        val user = AdminUser("user-id", "Cliente Uno", "cliente@example.com", "cliente", true)
        val repository = FakeAdminRepository(
            statisticsResult = ClientResult.Success(AdminStatistics("unidades", "Por semana", listOf("Transacciones" to "4"), categories)),
            clientsResult = ClientResult.Success(listOf(user)),
            changedUser = user.copy(role = "administrador")
        )
        val viewModel = AdminViewModel(repository)

        viewModel.loadStatistics()
        val statistics = (viewModel.state.value.statistics as ClientScreenState.Content).value
        assertEquals(categories, statistics.categories)
        viewModel.loadClients()
        viewModel.requestPromotion(user)
        assertEquals(user, viewModel.state.value.pendingPromotion)
        viewModel.confirmPromotion()

        assertEquals("user-id", repository.promotedUserId)
        assertEquals("administrador", repository.promotedRole)
        assertEquals(ClientScreenState.Empty, viewModel.state.value.clients)
        assertEquals("Cliente Uno ahora tiene el rol de administrador.", viewModel.state.value.roleChangeMessage)
    }
}

private class FakeAuthRepository(
    private val loginResult: LoginResult = LoginResult.Success(AccountRole.Client),
    private val registrationResult: RegistrationResult = RegistrationResult.Success(AccountRole.Client),
    private val completeLogin: Boolean = true
) : AuthRepository {
    var loginCalled = false
        private set
    var registrationCalled = false
        private set
    var registrationCredentials: RegistrationCredentials? = null
        private set
    var logoutCalled = false
        private set

    override fun login(credentials: AuthCredentials, onResult: (LoginResult) -> Unit) {
        loginCalled = true
        if (completeLogin) onResult(loginResult)
    }

    override fun register(credentials: RegistrationCredentials, onResult: (RegistrationResult) -> Unit) {
        registrationCalled = true
        registrationCredentials = credentials
        onResult(registrationResult)
    }

    override fun restoreSession(onResult: (SessionRestoreResult) -> Unit) = onResult(SessionRestoreResult.NoSession)
    override fun logout() { logoutCalled = true }
}

private class FakeClientRepository(
    var salesResult: ClientResult<List<SaleRecord>> = ClientResult.Success(emptyList()),
    var createSaleResult: ClientResult<Unit> = ClientResult.Success(Unit)
) : ClientRepository {
    val submittedSales = mutableListOf<SaleDraft>()

    override fun createSale(sale: SaleDraft, onResult: (ClientResult<Unit>) -> Unit) {
        submittedSales += sale
        onResult(createSaleResult)
    }

    override fun ownSales(onResult: (ClientResult<List<SaleRecord>>) -> Unit) = onResult(salesResult)
    override fun ownInsights(onResult: (ClientResult<ClientInsights>) -> Unit) = onResult(ClientResult.Success(
        ClientInsights(emptyList(), emptyList(), emptyList(), hasSales = false)
    ))
}

private class FakeAdminRepository(
    private val statisticsResult: ClientResult<AdminStatistics>,
    private val clientsResult: ClientResult<List<AdminUser>>,
    private val changedUser: AdminUser
) : AdminRepository {
    var promotedUserId: String? = null
        private set
    var promotedRole: String? = null
        private set

    override fun statistics(onResult: (ClientResult<AdminStatistics>) -> Unit) = onResult(statisticsResult)
    override fun clients(onResult: (ClientResult<List<AdminUser>>) -> Unit) = onResult(clientsResult)
    override fun changeRole(userId: String, role: String, onResult: (ClientResult<AdminUser>) -> Unit) {
        promotedUserId = userId
        promotedRole = role
        onResult(ClientResult.Success(changedUser))
    }
}
