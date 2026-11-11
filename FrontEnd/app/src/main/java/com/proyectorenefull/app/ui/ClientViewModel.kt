package com.proyectorenefull.app.ui

import androidx.lifecycle.ViewModel
import com.proyectorenefull.app.domain.client.ClientInsights
import com.proyectorenefull.app.domain.client.ClientRepository
import com.proyectorenefull.app.domain.client.ClientResult
import com.proyectorenefull.app.domain.client.SaleRecord
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
    private val _categories = MutableStateFlow<ClientScreenState<List<String>>>(ClientScreenState.Unavailable)
    val categories = _categories.asStateFlow()
    private val _sales = MutableStateFlow<ClientScreenState<List<SaleRecord>>>(ClientScreenState.Unavailable)
    val sales = _sales.asStateFlow()
    private val _insights = MutableStateFlow<ClientScreenState<ClientInsights>>(ClientScreenState.Unavailable)
    val insights = _insights.asStateFlow()

    fun loadCategories() {
        _categories.value = ClientScreenState.Loading
        repository.categories { result -> _categories.value = result.toScreenState { it.isEmpty() } }
    }

    fun loadOwnSales() {
        _sales.value = ClientScreenState.Loading
        repository.ownSales { result -> _sales.value = result.toScreenState { it.isEmpty() } }
    }

    fun loadOwnInsights() {
        _insights.value = ClientScreenState.Loading
        repository.ownInsights { result -> _insights.value = result.toScreenState { it.statistics.isEmpty() && it.prediction !is com.proyectorenefull.app.domain.client.PredictionValue.Estimate } }
    }
}

private fun <T> ClientResult<T>.toScreenState(isEmpty: (T) -> Boolean): ClientScreenState<T> = when (this) {
    is ClientResult.Success -> if (isEmpty(value)) ClientScreenState.Empty else ClientScreenState.Content(value)
    ClientResult.Unavailable -> ClientScreenState.Unavailable
    is ClientResult.Failure -> ClientScreenState.Error(message)
}
