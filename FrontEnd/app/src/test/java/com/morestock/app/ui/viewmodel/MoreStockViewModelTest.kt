package com.morestock.app.ui.viewmodel

import com.morestock.app.data.Business
import com.morestock.app.data.Forecast
import com.morestock.app.data.InventoryItem
import com.morestock.app.data.MoreStockDataSource
import com.morestock.app.data.Product
import com.morestock.app.data.Recommendation
import com.morestock.app.data.UserSession
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.test.resetMain
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MoreStockViewModelTest {
    @Test
    fun reopeningSameBusinessKeepsNewLoadActiveAfterOldLoadIsCancelled() = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        try {
            val repository = DelayedBusinessRepository()
            val viewModel = MoreStockViewModel(repository)
            val business = Business(id = "201", name = "Tienda", role = "business_admin")

            viewModel.login("user@example.test", "password")
            runCurrent()
            viewModel.selectBusiness(business)
            runCurrent()
            assertTrue(repository.firstLoadStarted.isCompleted)

            viewModel.selectBusiness(business)
            runCurrent()

            assertTrue(viewModel.state.value.isLoading)
            assertNull(viewModel.state.value.error)

            repository.secondProducts.complete(emptyList())
            runCurrent()
            assertFalse(viewModel.state.value.isLoading)
        } finally {
            Dispatchers.resetMain()
        }
    }

    @Test
    fun returningToBusinessListClearsCancelledLoadIndicator() = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        try {
            val repository = DelayedBusinessRepository()
            val viewModel = MoreStockViewModel(repository)
            val business = Business(id = "201", name = "Tienda", role = "business_admin")

            viewModel.login("user@example.test", "password")
            runCurrent()
            viewModel.selectBusiness(business)
            runCurrent()
            assertTrue(viewModel.state.value.isLoading)

            viewModel.goBackToBusinesses()
            runCurrent()

            assertNull(viewModel.state.value.selectedBusiness)
            assertFalse(viewModel.state.value.isLoading)
        } finally {
            Dispatchers.resetMain()
        }
    }

    @Test
    fun changingTabDoesNotHideBusinessDataThatIsStillLoading() = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        try {
            val repository = DelayedBusinessRepository()
            val viewModel = MoreStockViewModel(repository)
            val business = Business(id = "201", name = "Tienda", role = "business_admin")

            viewModel.login("user@example.test", "password")
            runCurrent()
            viewModel.selectBusiness(business)
            runCurrent()
            assertTrue(viewModel.state.value.isLoading)

            viewModel.selectTab(BusinessTab.CATALOG)
            runCurrent()

            assertTrue(viewModel.state.value.isLoading)
            repository.firstProducts.complete(emptyList())
            runCurrent()
            assertFalse(viewModel.state.value.isLoading)
        } finally {
            Dispatchers.resetMain()
        }
    }

    @Test
    fun reopeningSameProductKeepsNewForecastLoadActiveAfterOldLoadIsCancelled() = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        try {
            val repository = DelayedForecastRepository()
            val viewModel = MoreStockViewModel(repository)
            val business = Business(id = "201", name = "Tienda", role = "business_admin")

            viewModel.login("user@example.test", "password")
            runCurrent()
            viewModel.selectBusiness(business)
            runCurrent()
            viewModel.selectProduct("PS001")
            runCurrent()
            assertTrue(repository.firstForecastStarted.isCompleted)

            viewModel.goBackToBusiness()
            viewModel.selectProduct("PS001")
            runCurrent()

            assertTrue(viewModel.state.value.isLoading)
            assertNull(viewModel.state.value.error)

            repository.secondForecast.complete(Forecast(
                productName = "Manzana",
                unit = "pieza",
                horizonWeeks = 1,
                predictedDemand = 5.0,
                modelName = "linea-base",
                syntheticData = true,
                source = "synthetic",
                metrics = null,
                history = emptyList(),
                weeklyPredictions = emptyList(),
            ))
            runCurrent()
            assertFalse(viewModel.state.value.isLoading)
        } finally {
            Dispatchers.resetMain()
        }
    }

    @Test
    fun changingTabClearsCancelledForecastLoadingState() = runTest {
        Dispatchers.setMain(StandardTestDispatcher(testScheduler))
        try {
            val repository = DelayedForecastRepository()
            val viewModel = MoreStockViewModel(repository)
            val business = Business(id = "201", name = "Tienda", role = "business_admin")

            viewModel.login("user@example.test", "password")
            runCurrent()
            viewModel.selectBusiness(business)
            runCurrent()
            viewModel.selectProduct("SKU-SIN-CATALOGO")
            runCurrent()
            assertTrue(viewModel.state.value.isLoading)

            viewModel.selectTab(BusinessTab.CATALOG)
            runCurrent()

            assertFalse(viewModel.state.value.isLoading)
            assertNull(viewModel.state.value.selectedProductId)
        } finally {
            Dispatchers.resetMain()
        }
    }

    private class DelayedBusinessRepository : MoreStockDataSource {
        val firstLoadStarted = CompletableDeferred<Unit>()
        val firstProducts = CompletableDeferred<List<Product>>()
        val secondProducts = CompletableDeferred<List<Product>>()
        private var productLoads = 0

        override suspend fun login(email: String, password: String) = UserSession(
            token = "session-token",
            email = email,
            businesses = listOf(Business(id = "201", name = "Tienda", role = "business_admin")),
        )

        override suspend fun register(email: String, password: String, businessName: String) = UserSession(
            token = "session-token",
            email = email,
            businesses = listOf(Business(id = "201", name = businessName, role = "business_admin")),
        )

        override suspend fun logout(token: String) = Unit
        override suspend fun getBusinesses(token: String) = emptyList<Business>()

        override suspend fun getProducts(token: String, businessId: String): List<Product> {
            productLoads += 1
            if (productLoads == 1) {
                firstLoadStarted.complete(Unit)
                return firstProducts.await()
            }
            return secondProducts.await()
        }

        override suspend fun getInventory(token: String, businessId: String) = emptyList<InventoryItem>()
        override suspend fun updateInventory(
            token: String,
            businessId: String,
            productId: String,
            quantity: Double,
            unit: String,
            note: String?,
        ): InventoryItem = error("No se usa en esta prueba.")
        override suspend fun getRecommendations(token: String, businessId: String) = emptyList<Recommendation>()
        override suspend fun getForecast(token: String, businessId: String, productId: String): Forecast =
            error("No se usa en esta prueba.")
    }

    private class DelayedForecastRepository : MoreStockDataSource {
        val firstForecastStarted = CompletableDeferred<Unit>()
        val secondForecast = CompletableDeferred<Forecast>()
        private var forecastLoads = 0

        override suspend fun login(email: String, password: String) = UserSession(
            token = "session-token",
            email = email,
            businesses = listOf(Business(id = "201", name = "Tienda", role = "business_admin")),
        )

        override suspend fun register(email: String, password: String, businessName: String) = UserSession(
            token = "session-token",
            email = email,
            businesses = listOf(Business(id = "201", name = businessName, role = "business_admin")),
        )

        override suspend fun logout(token: String) = Unit
        override suspend fun getBusinesses(token: String) = emptyList<Business>()
        override suspend fun getProducts(token: String, businessId: String) = listOf(
            Product("PS001", "Manzana", "Fruta", "A granel", "pieza", 10.0),
        )
        override suspend fun getInventory(token: String, businessId: String) = emptyList<InventoryItem>()
        override suspend fun updateInventory(
            token: String,
            businessId: String,
            productId: String,
            quantity: Double,
            unit: String,
            note: String?,
        ): InventoryItem = error("No se usa en esta prueba.")
        override suspend fun getRecommendations(token: String, businessId: String) = emptyList<Recommendation>()

        override suspend fun getForecast(token: String, businessId: String, productId: String): Forecast {
            forecastLoads += 1
            if (forecastLoads == 1) {
                firstForecastStarted.complete(Unit)
                awaitCancellation()
            }
            return secondForecast.await()
        }
    }
}
