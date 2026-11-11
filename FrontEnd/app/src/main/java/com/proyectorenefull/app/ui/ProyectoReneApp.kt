package com.proyectorenefull.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.activity.compose.BackHandler
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.proyectorenefull.app.BuildConfig
import com.proyectorenefull.app.data.auth.AuthRepositoryFactory
import com.proyectorenefull.app.data.client.UnavailableClientRepository
import com.proyectorenefull.app.navigation.AppDestination
import com.proyectorenefull.app.navigation.AppNavigationViewModel
import com.proyectorenefull.app.ui.admin.AdminClientsScreen
import com.proyectorenefull.app.ui.admin.AdminDashboardScreen
import com.proyectorenefull.app.ui.auth.LoginScreen
import com.proyectorenefull.app.ui.auth.RegisterScreen
import com.proyectorenefull.app.ui.client.ClientHomeScreen
import com.proyectorenefull.app.ui.client.ClientInsightsScreen
import com.proyectorenefull.app.ui.client.OwnSalesScreen
import com.proyectorenefull.app.ui.client.PreviewPickerScreen
import com.proyectorenefull.app.ui.client.SaleFormScreen

@Composable
fun ProyectoReneApp(
    navigation: AppNavigationViewModel = viewModel()
) {
    val authFactory = remember { AuthViewModelFactory(AuthRepositoryFactory.create()) }
    val authViewModel: AuthViewModel = viewModel(factory = authFactory)
    val clientFactory = remember { ClientViewModelFactory(UnavailableClientRepository()) }
    val clientViewModel: ClientViewModel = viewModel(factory = clientFactory)
    val saleFormViewModel: VentaFormViewModel = viewModel(factory = clientFactory)
    val destination by navigation.destination.collectAsStateWithLifecycle()
    val isPreview by navigation.isPreview.collectAsStateWithLifecycle()
    val authState by authViewModel.state.collectAsStateWithLifecycle()
    val categoryState by clientViewModel.categories.collectAsStateWithLifecycle()
    val salesState by clientViewModel.sales.collectAsStateWithLifecycle()
    val insightsState by clientViewModel.insights.collectAsStateWithLifecycle()
    LaunchedEffect(destination) {
        when (destination) {
            AppDestination.SaleForm -> clientViewModel.loadCategories()
            AppDestination.OwnSales -> clientViewModel.loadOwnSales()
            AppDestination.ClientInsights -> clientViewModel.loadOwnInsights()
            else -> Unit
        }
    }
    BackHandler(enabled = destination != AppDestination.Login) {
        if (destination == AppDestination.Register) authViewModel.clearPassword()
        navigation.back()
    }

    LaunchedEffect(authState.authenticatedRole) {
        authState.authenticatedRole?.let { role ->
            navigation.navigateAfterAuthentication(role, authState.isPreviewSession)
            authViewModel.clearAuthenticationResult()
        }
    }

    val exitPreview = {
        authViewModel.clearPassword()
        authViewModel.clearPreviewState()
        navigation.closePreview()
    }

    when (destination) {
        AppDestination.Login -> LoginScreen(
            viewModel = authViewModel,
            onRegister = { navigation.navigate(AppDestination.Register) },
            onPreview = {
                if (BuildConfig.DEBUG) {
                    authViewModel.clearPassword()
                    navigation.navigate(AppDestination.PreviewPicker)
                }
            }
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
            LoginScreen(
                viewModel = authViewModel,
                onRegister = { navigation.navigate(AppDestination.Register) },
                onPreview = {}
            )
        }

        AppDestination.ClientHome -> ClientHomeScreen(
            isPreview = isPreview,
            onSale = { navigation.navigate(AppDestination.SaleForm) },
            onOwnSales = { navigation.navigate(AppDestination.OwnSales) },
            onInsights = { navigation.navigate(AppDestination.ClientInsights) },
            onExitPreview = exitPreview
        )

        AppDestination.SaleForm -> SaleFormScreen(
            viewModel = saleFormViewModel,
            categories = categoryState,
            isPreview = isPreview,
            onBack = navigation::back,
            onExitPreview = exitPreview
        )

        AppDestination.OwnSales -> OwnSalesScreen(
            sales = salesState,
            isPreview = isPreview,
            onBack = navigation::back,
            onExitPreview = exitPreview
        )

        AppDestination.ClientInsights -> ClientInsightsScreen(
            insights = insightsState,
            isPreview = isPreview,
            onBack = navigation::back,
            onExitPreview = exitPreview
        )

        AppDestination.AdminDashboard -> AdminDashboardScreen(
            isPreview = isPreview,
            onClients = { navigation.navigate(AppDestination.AdminClients) },
            onExitPreview = exitPreview
        )

        AppDestination.AdminClients -> AdminClientsScreen(
            isPreview = isPreview,
            onBack = navigation::back,
            onExitPreview = exitPreview
        )
    }
}
