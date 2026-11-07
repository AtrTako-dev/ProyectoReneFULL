package com.proyectorenefull.app.navigation

import com.proyectorenefull.app.domain.auth.AccountRole
import org.junit.Assert.assertEquals
import org.junit.Test

class AppNavigationViewModelTest {
    @Test
    fun authenticatedClientOpensClientHome() {
        val viewModel = AppNavigationViewModel()

        viewModel.navigateAfterAuthentication(AccountRole.Client, isPreview = false)

        assertEquals(AppDestination.ClientHome, viewModel.destination.value)
        assertEquals(false, viewModel.isPreview.value)
    }

    @Test
    fun authenticatedAdministratorOpensAdminDashboard() {
        val viewModel = AppNavigationViewModel()

        viewModel.navigateAfterAuthentication(AccountRole.Administrator, isPreview = false)

        assertEquals(AppDestination.AdminDashboard, viewModel.destination.value)
    }

    @Test
    fun previewSessionIsMarkedSeparatelyFromAuthentication() {
        val viewModel = AppNavigationViewModel()

        viewModel.navigateAfterAuthentication(AccountRole.Client, isPreview = true)

        assertEquals(true, viewModel.isPreview.value)
    }
}
