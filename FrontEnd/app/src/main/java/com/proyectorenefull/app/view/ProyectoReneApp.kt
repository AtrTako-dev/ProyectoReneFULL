package com.proyectorenefull.app.view

import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.proyectorenefull.app.BuildConfig
import com.proyectorenefull.app.data.AppContainer
import com.proyectorenefull.app.navigation.AppDestination
import com.proyectorenefull.app.navigation.AppNavigationViewModel
import com.proyectorenefull.app.view.admin.AdminClientsScreen
import com.proyectorenefull.app.view.admin.AdminDashboardScreen
import com.proyectorenefull.app.view.auth.LoginScreen
import com.proyectorenefull.app.view.auth.RegisterScreen
import com.proyectorenefull.app.view.client.ClientHomeScreen
import com.proyectorenefull.app.view.client.ClientInsightsScreen
import com.proyectorenefull.app.view.client.OwnSalesScreen
import com.proyectorenefull.app.view.client.PreviewPickerScreen
import com.proyectorenefull.app.view.client.SaleFormScreen
import com.proyectorenefull.app.viewmodel.AdminViewModel
import com.proyectorenefull.app.viewmodel.AdminViewModelFactory
import com.proyectorenefull.app.viewmodel.AuthViewModel
import com.proyectorenefull.app.viewmodel.AuthViewModelFactory
import com.proyectorenefull.app.viewmodel.ClientViewModel
import com.proyectorenefull.app.viewmodel.ClientViewModelFactory
import com.proyectorenefull.app.viewmodel.VentaFormViewModel

@Composable
fun ProyectoReneApp(navigation: AppNavigationViewModel = viewModel()) {
    val context = LocalContext.current.applicationContext
    val container = remember(context) { AppContainer(context) }
    val authFactory = remember(container) { AuthViewModelFactory(container.authRepository) }
    val clientFactory = remember(container) { ClientViewModelFactory(container.clientRepository) }
    val adminFactory = remember(container) { AdminViewModelFactory(container.adminRepository) }

    val authViewModel: AuthViewModel = viewModel(factory = authFactory)
    val clientViewModel: ClientViewModel = viewModel(factory = clientFactory)
    val saleFormViewModel: VentaFormViewModel = viewModel(factory = clientFactory)
    val adminViewModel: AdminViewModel = viewModel(factory = adminFactory)

    val destination by navigation.destination.collectAsStateWithLifecycle()
    val isPreview by navigation.isPreview.collectAsStateWithLifecycle()
    val authState by authViewModel.state.collectAsStateWithLifecycle()
    val salesState by clientViewModel.sales.collectAsStateWithLifecycle()
    val insightsState by clientViewModel.insights.collectAsStateWithLifecycle()
    val saleState by saleFormViewModel.state.collectAsStateWithLifecycle()
    val adminState by adminViewModel.state.collectAsStateWithLifecycle()
    val clientSessionExpired by clientViewModel.sessionExpired.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        authViewModel.restoreSession()
    }

    LaunchedEffect(destination, isPreview) {
        if (isPreview) return@LaunchedEffect
        when (destination) {
            AppDestination.OwnSales -> clientViewModel.loadOwnSales()
            AppDestination.ClientInsights -> clientViewModel.loadOwnInsights()
            AppDestination.AdminDashboard -> adminViewModel.loadStatistics()
            AppDestination.AdminClients -> adminViewModel.loadClients()
            else -> Unit
        }
    }

    LaunchedEffect(clientSessionExpired, saleState.sessionExpired, adminState.sessionExpired) {
        if (clientSessionExpired || saleState.sessionExpired || adminState.sessionExpired) {
            clientViewModel.resetSession()
            saleFormViewModel.resetSession()
            adminViewModel.resetSession()
            authViewModel.showSessionExpired()
            navigation.closeSession()
        }
    }

    BackHandler(enabled = destination != AppDestination.Login) {
        if (destination == AppDestination.Register) authViewModel.clearPassword()
        navigation.back()
    }

    LaunchedEffect(authState.authenticatedRole) {
        authState.authenticatedRole?.let { role ->
            navigation.navigateAfterAuthentication(role, isPreview = false)
            authViewModel.clearAuthenticationResult()
        }
    }

    val exitPreview = {
        authViewModel.clearPassword()
        clientViewModel.resetSession()
        saleFormViewModel.resetSession()
        adminViewModel.resetSession()
        navigation.closeSession()
    }
    val logout = {
        authViewModel.logout()
        clientViewModel.resetSession()
        saleFormViewModel.resetSession()
        adminViewModel.resetSession()
        navigation.closeSession()
    }
    val finishSession = if (isPreview) exitPreview else logout

    when (destination) {
        AppDestination.Login -> LoginScreen(
            viewModel = authViewModel,
            onRegister = { navigation.navigate(AppDestination.Register) },
            onPreview = if (BuildConfig.DEBUG) {
                {
                    authViewModel.clearPassword()
                    navigation.navigate(AppDestination.PreviewPicker)
                }
            } else null
        )

        AppDestination.Register -> RegisterScreen(
            viewModel = authViewModel,
            onBack = {
                authViewModel.clearPassword()
                navigation.back()
            }
        )

        AppDestination.PreviewPicker -> if (BuildConfig.DEBUG) {
            PreviewPickerScreen(
                onBack = navigation::back,
                onChooseClient = { navigation.openPreview(isAdministrator = false) },
                onChooseAdmin = { navigation.openPreview(isAdministrator = true) }
            )
        } else {
            LoginScreen(viewModel = authViewModel, onRegister = null, onPreview = null)
        }

        AppDestination.ClientHome -> ClientHomeScreen(
            isPreview = isPreview,
            onSale = { navigation.navigate(AppDestination.SaleForm) },
            onOwnSales = { navigation.navigate(AppDestination.OwnSales) },
            onInsights = { navigation.navigate(AppDestination.ClientInsights) },
            onExit = finishSession
        )

        AppDestination.SaleForm -> SaleFormScreen(
            viewModel = saleFormViewModel,
            isPreview = isPreview,
            onBack = navigation::back,
            onExit = finishSession
        )

        AppDestination.OwnSales -> OwnSalesScreen(
            sales = salesState,
            isPreview = isPreview,
            onBack = navigation::back,
            onExit = finishSession,
            onRetry = clientViewModel::loadOwnSales
        )

        AppDestination.ClientInsights -> ClientInsightsScreen(
            insights = insightsState,
            isPreview = isPreview,
            onBack = navigation::back,
            onExit = finishSession,
            onRetry = clientViewModel::loadOwnInsights
        )

        AppDestination.AdminDashboard -> AdminDashboardScreen(
            viewModel = adminViewModel,
            isPreview = isPreview,
            onClients = { navigation.navigate(AppDestination.AdminClients) },
            onExit = finishSession,
            onRetry = adminViewModel::loadStatistics
        )

        AppDestination.AdminClients -> AdminClientsScreen(
            viewModel = adminViewModel,
            isPreview = isPreview,
            onBack = navigation::back,
            onExit = finishSession,
            onRetry = adminViewModel::loadClients
        )
    }
}
