package com.proyectorenefull.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.proyectorenefull.app.domain.client.ClientRepository

class ClientViewModelFactory(private val repository: ClientRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = when {
        modelClass.isAssignableFrom(ClientViewModel::class.java) -> ClientViewModel(repository) as T
        modelClass.isAssignableFrom(VentaFormViewModel::class.java) -> VentaFormViewModel(repository) as T
        else -> throw IllegalArgumentException("ViewModel no compatible: ${modelClass.name}")
    }
}
