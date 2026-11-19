package com.proyectorenefull.app.viewmodel

import androidx.lifecycle.ViewModel
import com.proyectorenefull.app.model.client.ClientInsights
import com.proyectorenefull.app.model.client.ClientRepository
import com.proyectorenefull.app.model.client.ClientResult
import com.proyectorenefull.app.model.client.SaleRecord
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

sealed interface ClientScreenState<out T> {
    data object Loading : ClientScreenState<Nothing>
    data object Unavailable : ClientScreenState<Nothing>
    data object Empty : ClientScreenState<Nothing>
    data class Content<T>(val value: T) : ClientScreenState<T>
    data class Error(val message: String) : ClientScreenState<Nothing>
}

class ClientViewModel(private val repository: ClientRepository) : ViewModel() {
    private val _sales = MutableStateFlow<ClientScreenState<List<SaleRecord>>>(ClientScreenState.Unavailable)
    val sales = _sales.asStateFlow()

    private val _insights = MutableStateFlow<ClientScreenState<ClientInsights>>(ClientScreenState.Unavailable)
    val insights = _insights.asStateFlow()

    private val _sessionExpired = MutableStateFlow(false)
    val sessionExpired = _sessionExpired.asStateFlow()

    fun loadOwnSales() {
        _sales.value = ClientScreenState.Loading
        repository.ownSales { result ->
            _sales.value = result.toScreenState { it.isEmpty() }
            if (result.requiresLogin()) _sessionExpired.value = true
        }
    }

    fun loadOwnInsights() {
        _insights.value = ClientScreenState.Loading
        repository.ownInsights { result ->
            _insights.value = result.toScreenState { !it.hasSales }
            if (result.requiresLogin()) _sessionExpired.value = true
        }
    }

    fun clearSessionExpired() {
        _sessionExpired.value = false
    }

    fun resetSession() {
        _sales.value = ClientScreenState.Unavailable
        _insights.value = ClientScreenState.Unavailable
        _sessionExpired.value = false
    }
}

private fun <T> ClientResult<T>.toScreenState(isEmpty: (T) -> Boolean): ClientScreenState<T> = when (this) {
    is ClientResult.Success -> if (isEmpty(value)) ClientScreenState.Empty else ClientScreenState.Content(value)
    ClientResult.Unavailable -> ClientScreenState.Unavailable
    is ClientResult.Failure -> ClientScreenState.Error(message)
}

private fun ClientResult<*>.requiresLogin(): Boolean =
    this is ClientResult.Failure && requiresLogin
