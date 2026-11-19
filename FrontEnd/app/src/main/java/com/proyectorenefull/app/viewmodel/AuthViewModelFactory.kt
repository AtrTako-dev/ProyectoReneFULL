package com.proyectorenefull.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.proyectorenefull.app.model.auth.AuthRepository

class AuthViewModelFactory(
    private val repository: AuthRepository
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (!modelClass.isAssignableFrom(AuthViewModel::class.java)) {
            throw IllegalArgumentException("ViewModel no compatible: ${modelClass.name}")
        }
        return AuthViewModel(repository) as T
    }
}
