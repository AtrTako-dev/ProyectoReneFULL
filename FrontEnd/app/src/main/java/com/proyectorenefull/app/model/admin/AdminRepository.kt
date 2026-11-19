package com.proyectorenefull.app.model.admin

import com.proyectorenefull.app.model.client.ClientResult

interface AdminRepository {
    fun statistics(onResult: (ClientResult<AdminStatistics>) -> Unit)
    fun clients(onResult: (ClientResult<List<AdminUser>>) -> Unit)
    fun changeRole(userId: String, role: String, onResult: (ClientResult<AdminUser>) -> Unit)
}
