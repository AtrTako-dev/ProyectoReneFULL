package com.proyectorenefull.app.viewmodel

import androidx.lifecycle.ViewModel
import com.proyectorenefull.app.model.admin.AdminRepository
import com.proyectorenefull.app.model.admin.AdminStatistics
import com.proyectorenefull.app.model.admin.AdminUser
import com.proyectorenefull.app.model.client.ClientResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

data class AdminUiState(
    val statistics: ClientScreenState<AdminStatistics> = ClientScreenState.Unavailable,
    val clients: ClientScreenState<List<AdminUser>> = ClientScreenState.Unavailable,
    val pendingPromotion: AdminUser? = null,
    val changingRoleFor: String? = null,
    val roleChangeMessage: String? = null,
    val roleChangeIsError: Boolean = false,
    val sessionExpired: Boolean = false
)

class AdminViewModel(private val repository: AdminRepository) : ViewModel() {
    private val _state = MutableStateFlow(AdminUiState())
    val state = _state.asStateFlow()

    fun loadStatistics() {
        _state.value = _state.value.copy(statistics = ClientScreenState.Loading)
        repository.statistics { result ->
            _state.value = _state.value.copy(
                statistics = result.toState { false },
                sessionExpired = _state.value.sessionExpired || result.requiresLogin()
            )
        }
    }

    fun loadClients() {
        _state.value = _state.value.copy(clients = ClientScreenState.Loading, roleChangeMessage = null)
        repository.clients { result ->
            _state.value = _state.value.copy(
                clients = result.toState { it.isEmpty() },
                sessionExpired = _state.value.sessionExpired || result.requiresLogin()
            )
        }
    }

    fun requestPromotion(user: AdminUser) {
        if (user.role != "cliente" || !user.active || _state.value.changingRoleFor != null) return
        _state.value = _state.value.copy(pendingPromotion = user, roleChangeMessage = null)
    }

    fun dismissPromotion() {
        _state.value = _state.value.copy(pendingPromotion = null)
    }

    fun confirmPromotion() {
        val user = _state.value.pendingPromotion ?: return
        _state.value = _state.value.copy(
            pendingPromotion = null,
            changingRoleFor = user.id,
            roleChangeMessage = null,
            roleChangeIsError = false
        )
        repository.changeRole(user.id, "administrador") { result ->
            when (result) {
                is ClientResult.Success -> {
                    if (result.value.role != "administrador") {
                        _state.value = _state.value.copy(
                            changingRoleFor = null,
                            roleChangeMessage = "El servidor no confirmó el nuevo rol.",
                            roleChangeIsError = true
                        )
                        return@changeRole
                    }
                    val current = _state.value.clients
                    val updated = if (current is ClientScreenState.Content) {
                        val remaining = current.value.filterNot { it.id == result.value.id }
                        if (remaining.isEmpty()) ClientScreenState.Empty else ClientScreenState.Content(remaining)
                    } else current
                    _state.value = _state.value.copy(
                        clients = updated,
                        changingRoleFor = null,
                        roleChangeMessage = "${result.value.name} ahora tiene el rol de administrador.",
                        roleChangeIsError = false
                    )
                }
                ClientResult.Unavailable -> _state.value = _state.value.copy(
                    changingRoleFor = null,
                    roleChangeMessage = "El servicio no está disponible. No se confirmó el cambio.",
                    roleChangeIsError = true
                )
                is ClientResult.Failure -> _state.value = _state.value.copy(
                    changingRoleFor = null,
                    roleChangeMessage = result.message,
                    roleChangeIsError = true,
                    sessionExpired = _state.value.sessionExpired || result.requiresLogin
                )
            }
        }
    }

    fun clearSessionExpired() {
        _state.value = _state.value.copy(sessionExpired = false)
    }

    fun resetSession() {
        _state.value = AdminUiState()
    }
}

private fun <T> ClientResult<T>.toState(isEmpty: (T) -> Boolean): ClientScreenState<T> = when (this) {
    is ClientResult.Success -> if (isEmpty(value)) ClientScreenState.Empty else ClientScreenState.Content(value)
    ClientResult.Unavailable -> ClientScreenState.Unavailable
    is ClientResult.Failure -> ClientScreenState.Error(message)
}

private fun ClientResult<*>.requiresLogin(): Boolean = this is ClientResult.Failure && requiresLogin
