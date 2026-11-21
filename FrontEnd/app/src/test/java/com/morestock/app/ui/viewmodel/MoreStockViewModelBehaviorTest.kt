package com.morestock.app.ui.viewmodel

import com.morestock.app.data.Business
import com.morestock.app.data.Forecast
import com.morestock.app.data.InventoryItem
import com.morestock.app.data.MoreStockApiException
import com.morestock.app.data.MoreStockDataSource
import com.morestock.app.data.Product
import com.morestock.app.data.Recommendation
import com.morestock.app.data.UserSession
import java.io.IOException
import java.net.SocketTimeoutException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestCoroutineScheduler
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MoreStockViewModelBehaviorTest {
    @Test
    fun successfulLoginStoresSessionAndClearsLoading() = runTest {
        withMainDispatcher(testScheduler) {
            val source = ControlledDataSource()
            val viewModel = MoreStockViewModel(source)

            viewModel.login("  tienda@example.test  ", "secret")
            runCurrent()

            assertEquals("session-token", viewModel.state.value.token)
            assertEquals("tienda@example.test", source.receivedEmail)
            assertEquals("tienda@example.test", viewModel.state.value.email)
            assertEquals(listOf(BUSINESS), viewModel.state.value.businesses)
            assertFalse(viewModel.state.value.isLoading)
            assertNull(viewModel.state.value.error)
        }
    }

    @Test
    fun successfulRegistrationStoresSessionAndItsBusiness() = runTest {
        withMainDispatcher(testScheduler) {
            val source = ControlledDataSource().apply {
                session = UserSession(
                    token = "new-session-token",
                    email = "nueva@example.test",
                    businesses = listOf(BUSINESS.copy(name = "Mi tienda")),
                )
            }
            val viewModel = MoreStockViewModel(source)

            viewModel.register(" nueva@example.test ", "secreto123", "Mi tienda")
            runCurrent()

            assertEquals("new-session-token", viewModel.state.value.token)
            assertEquals("nueva@example.test", viewModel.state.value.email)
            assertEquals("Mi tienda", viewModel.state.value.businesses.single().name)
            assertEquals("nueva@example.test", source.receivedEmail)
            assertEquals("Mi tienda", source.registeredBusinessName)
            assertFalse(viewModel.state.value.isLoading)
            assertNull(viewModel.state.value.error)
        }
    }

    @Test
    fun registrationDoesNotSendTwiceWhileTheFirstRequestIsLoading() = runTest {
        withMainDispatcher(testScheduler) {
            val source = ControlledDataSource().apply { registrationGate = CompletableDeferred() }
            val viewModel = MoreStockViewModel(source)

            viewModel.register("nueva@example.test", "secreto123", "Mi tienda")
            runCurrent()
            viewModel.register("nueva@example.test", "secreto123", "Mi tienda")
            runCurrent()

            assertEquals(1, source.registrationCalls)
            assertTrue(viewModel.state.value.isLoginLoading)
            source.registrationGate?.complete(Unit)
            runCurrent()
            assertFalse(viewModel.state.value.isLoading)
        }
    }

    @Test
    fun invalidCredentialsAreShownAsLoginError() = runTest {
        withMainDispatcher(testScheduler) {
            val source = ControlledDataSource().apply {
                loginFailure = MoreStockApiException("Correo o contraseña incorrectos.", 401)
            }
            val viewModel = MoreStockViewModel(source)

            viewModel.login("tienda@example.test", "wrong")
            runCurrent()

            assertNull(viewModel.state.value.token)
            assertEquals("Correo o contraseña incorrectos.", viewModel.state.value.error)
            assertFalse(viewModel.state.value.isLoading)
        }
    }

    @Test
    fun clearingAnAuthenticationErrorAlsoClearsRetryState() = runTest {
        withMainDispatcher(testScheduler) {
            val source = ControlledDataSource().apply { loginFailure = SocketTimeoutException("Read timed out") }
            val viewModel = MoreStockViewModel(source)
            viewModel.login("tienda@example.test", "secreto123")
            runCurrent()
            assertTrue(viewModel.state.value.canRetry)

            viewModel.clearError()

            assertNull(viewModel.state.value.error)
            assertFalse(viewModel.state.value.canRetry)
        }
    }

    @Test
    fun networkFailureIsShownWithReadableMessage() = runTest {
        withMainDispatcher(testScheduler) {
            val source = ControlledDataSource().apply { loginFailure = IOException("Connection refused") }
            val viewModel = MoreStockViewModel(source)

            viewModel.login("tienda@example.test", "secret")
            runCurrent()

            assertEquals("No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.", viewModel.state.value.error)
            assertFalse(viewModel.state.value.isLoading)
        }
    }

    @Test
    fun rateLimitIsShownWithReadableMessage() = runTest {
        withMainDispatcher(testScheduler) {
            val source = ControlledDataSource().apply {
                loginFailure = MoreStockApiException("LOGIN_RATE_LIMITED", 429, retryAfterSeconds = 35)
            }
            val viewModel = MoreStockViewModel(source)

            viewModel.login("tienda@example.test", "secret")
            runCurrent()

            assertEquals("El servidor limitó temporalmente las solicitudes.", viewModel.state.value.error)
            assertEquals(35L, viewModel.state.value.authRetryAfterSeconds)
            assertFalse(viewModel.state.value.isLoading)

            viewModel.login("tienda@example.test", "secret")
            runCurrent()
            assertEquals(1, source.loginCalls)

            advanceTimeBy(35_000)
            runCurrent()
            assertNull(viewModel.state.value.authRetryAfterSeconds)
            assertEquals("El servidor limitó temporalmente las solicitudes.", viewModel.state.value.error)
        }
    }

    @Test
    fun clearingRateLimitErrorKeepsTheCooldownVisibleUntilItExpires() = runTest {
        withMainDispatcher(testScheduler) {
            val source = ControlledDataSource().apply {
                loginFailure = MoreStockApiException("LOGIN_RATE_LIMITED", 429, retryAfterSeconds = 3)
            }
            val viewModel = MoreStockViewModel(source)

            viewModel.login("tienda@example.test", "secret")
            runCurrent()
            viewModel.clearError()

            assertNull(viewModel.state.value.error)
            assertEquals(3L, viewModel.state.value.authRetryAfterSeconds)

            advanceTimeBy(3_000)
            runCurrent()
            assertNull(viewModel.state.value.authRetryAfterSeconds)
        }
    }

    @Test
    fun serverTimeoutShowsSlowServerMessageAndAllowsRetry() = runTest {
        withMainDispatcher(testScheduler) {
            val source = ControlledDataSource().apply {
                loginFailure = SocketTimeoutException("Read timed out")
            }
            val viewModel = MoreStockViewModel(source)

            viewModel.login("tienda@example.test", "secret")
            runCurrent()

            assertEquals("El servidor está tardando en responder. Revisa tu conexión e inténtalo de nuevo.", viewModel.state.value.error)
            assertTrue(viewModel.state.value.canRetry)

            source.loginFailure = null
            viewModel.login("tienda@example.test", "secret")
            runCurrent()

            assertFalse(viewModel.state.value.canRetry)
            assertNull(viewModel.state.value.error)
        }
    }

    @Test
    fun loadingAndEmptyBusinessStateAreRepresented() = runTest {
        withMainDispatcher(testScheduler) {
            val source = ControlledDataSource().apply {
                loginGate = CompletableDeferred()
                inventoryGate = CompletableDeferred()
                session = UserSession("session-token", "tienda@example.test", listOf(BUSINESS))
                products = emptyList()
                inventory = emptyList()
            }
            val viewModel = MoreStockViewModel(source)

            viewModel.login("tienda@example.test", "secret")
            runCurrent()
            assertTrue(viewModel.state.value.isLoginLoading)

            source.loginGate!!.complete(Unit)
            runCurrent()
            assertFalse(viewModel.state.value.isLoading)
            assertTrue(viewModel.state.value.businesses.isNotEmpty())

            viewModel.selectBusiness(BUSINESS)
            runCurrent()
            assertTrue(viewModel.state.value.isBusinessLoading)

            source.inventoryGate!!.complete(Unit)
            runCurrent()
            assertFalse(viewModel.state.value.isLoading)
            assertTrue(viewModel.state.value.products.isEmpty())
            assertTrue(viewModel.state.value.inventory.isEmpty())
            assertTrue(viewModel.state.value.recommendations.isEmpty())
        }
    }

    @Test
    fun emptyBusinessListIsAvailableAfterLogin() = runTest {
        withMainDispatcher(testScheduler) {
            val source = ControlledDataSource().apply {
                session = UserSession("session-token", "tienda@example.test", emptyList())
            }
            val viewModel = MoreStockViewModel(source)

            viewModel.login("tienda@example.test", "secret")
            runCurrent()

            assertTrue(viewModel.state.value.businesses.isEmpty())
            assertFalse(viewModel.state.value.isLoading)
            assertNull(viewModel.state.value.error)
        }
    }

    @Test
    fun validInventoryUpdateReloadsBusinessData() = runTest {
        withMainDispatcher(testScheduler) {
            val source = ControlledDataSource()
            val viewModel = signedInViewModel(source)
            runCurrent()
            viewModel.selectBusiness(BUSINESS)
            runCurrent()
            assertEquals(5.0, viewModel.state.value.inventory.single().quantity, 0.0)

            viewModel.updateInventory("PS001", 9.0)
            runCurrent()

            assertEquals(1, source.updateCalls)
            assertEquals(2, source.inventoryLoads)
            assertEquals(9.0, viewModel.state.value.inventory.single().quantity, 0.0)
            assertNull(viewModel.state.value.error)
            assertFalse(viewModel.state.value.isLoading)
        }
    }

    @Test
    fun invalidInventoryQuantityDoesNotReachDataSource() = runTest {
        withMainDispatcher(testScheduler) {
            val source = ControlledDataSource()
            val viewModel = signedInViewModel(source)
            runCurrent()
            viewModel.selectBusiness(BUSINESS)
            runCurrent()

            viewModel.updateInventory("PS001", -1.0)
            runCurrent()

            assertEquals(0, source.updateCalls)
            assertTrue(viewModel.state.value.error.orEmpty().isNotBlank())
            assertFalse(viewModel.state.value.isLoading)
        }
    }

    @Test
    fun nonFiniteOrOverPreciseInventoryQuantityIsRejected() = runTest {
        withMainDispatcher(testScheduler) {
            val source = ControlledDataSource()
            val viewModel = signedInViewModel(source)
            runCurrent()
            viewModel.selectBusiness(BUSINESS)
            runCurrent()

            viewModel.updateInventory("PS001", Double.NaN)
            runCurrent()
            assertEquals(0, source.updateCalls)
            assertTrue(viewModel.state.value.error.orEmpty().isNotBlank())

            viewModel.updateInventory("PS001", 1.2345)
            runCurrent()
            assertEquals(0, source.updateCalls)
        }
    }

    private fun signedInViewModel(source: ControlledDataSource): MoreStockViewModel =
        MoreStockViewModel(source).apply { login("tienda@example.test", "secret") }

    private suspend fun withMainDispatcher(scheduler: TestCoroutineScheduler, block: suspend () -> Unit) {
        Dispatchers.setMain(StandardTestDispatcher(scheduler))
        try {
            block()
        } finally {
            Dispatchers.resetMain()
        }
    }

    private class ControlledDataSource : MoreStockDataSource {
        var session = UserSession("session-token", "tienda@example.test", listOf(BUSINESS))
        var loginFailure: Exception? = null
        var loginGate: CompletableDeferred<Unit>? = null
        var registrationGate: CompletableDeferred<Unit>? = null
        var inventoryGate: CompletableDeferred<Unit>? = null
        var products = listOf(Product("PS001", "Manzana", "Fruta", "A granel", "pieza", 5.0))
        var inventory = listOf(InventoryItem("PS001", "Manzana", 5.0, "pieza", false, "actual"))
        var receivedEmail: String? = null
        var registeredBusinessName: String? = null
        var registrationCalls = 0
        var loginCalls = 0
        var inventoryLoads = 0
        var updateCalls = 0

        override suspend fun login(email: String, password: String): UserSession {
            loginCalls += 1
            receivedEmail = email
            loginGate?.await()
            loginFailure?.let { throw it }
            return session.copy(email = email)
        }

        override suspend fun register(email: String, password: String, businessName: String): UserSession {
            registrationCalls += 1
            receivedEmail = email
            registeredBusinessName = businessName
            registrationGate?.await()
            return session.copy(email = email)
        }

        override suspend fun logout(token: String) = Unit
        override suspend fun getBusinesses(token: String) = listOf(BUSINESS)
        override suspend fun getProducts(token: String, businessId: String): List<Product> = products

        override suspend fun getInventory(token: String, businessId: String): List<InventoryItem> {
            inventoryLoads += 1
            inventoryGate?.await()
            return inventory
        }

        override suspend fun getRecommendations(token: String, businessId: String): List<Recommendation> = emptyList()
        override suspend fun getForecast(token: String, businessId: String, productId: String): Forecast =
            error("No se usa en esta prueba.")

        override suspend fun updateInventory(
            token: String,
            businessId: String,
            productId: String,
            quantity: Double,
            unit: String,
            note: String?,
        ): InventoryItem {
            updateCalls += 1
            return InventoryItem(productId, "Manzana", quantity, unit, false, "actual").also {
                inventory = listOf(it)
            }
        }
    }

    private companion object {
        val BUSINESS = Business(id = "201", name = "Tienda", role = "business_admin")
    }
}
