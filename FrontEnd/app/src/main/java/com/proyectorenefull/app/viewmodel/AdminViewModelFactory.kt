package com.proyectorenefull.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.proyectorenefull.app.model.admin.AdminRepository

class AdminViewModelFactory(private val repository: AdminRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (!modelClass.isAssignableFrom(AdminViewModel::class.java)) {
            throw IllegalArgumentException("ViewModel no compatible: ${modelClass.name}")
        }
        return AdminViewModel(repository) as T
    }
}
