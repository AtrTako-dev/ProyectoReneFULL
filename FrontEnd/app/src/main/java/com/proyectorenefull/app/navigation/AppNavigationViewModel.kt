package com.proyectorenefull.app.navigation

import androidx.lifecycle.ViewModel
import com.proyectorenefull.app.BuildConfig
import com.proyectorenefull.app.domain.auth.AccountRole
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

class AppNavigationViewModel : ViewModel() {
    private val history = mutableListOf(AppDestination.Login)
    private val _destination = MutableStateFlow(AppDestination.Login)
    val destination = _destination.asStateFlow()
    private val _isPreview = MutableStateFlow(false)
    val isPreview = _isPreview.asStateFlow()

    fun navigate(destination: AppDestination) {
        if (destination == _destination.value) return
        history += destination
        _destination.value = destination
    }

    fun openPreview(isAdministrator: Boolean) {
        if (!BuildConfig.DEBUG) return
        _isPreview.value = true
        navigate(
            if (isAdministrator) AppDestination.AdminDashboard
            else AppDestination.ClientHome
        )
    }

    fun navigateAfterAuthentication(role: AccountRole, isPreview: Boolean) {
        val destination = when (role) {
            AccountRole.Client -> AppDestination.ClientHome
            AccountRole.Administrator -> AppDestination.AdminDashboard
        }
        history.clear()
        history += AppDestination.Login
        history += destination
        _destination.value = destination
        _isPreview.value = isPreview
    }

    fun back() {
        if (history.size > 1) {
            history.removeAt(history.lastIndex)
            _destination.value = history.last()
            if (_destination.value == AppDestination.Login) _isPreview.value = false
        }
    }

    fun closePreview() {
        history.clear()
        history += AppDestination.Login
        _destination.value = AppDestination.Login
        _isPreview.value = false
    }
}
