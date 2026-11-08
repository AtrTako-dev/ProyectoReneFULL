package com.proyectorenefull.app.domain.client

interface ClientRepository {
    fun categories(onResult: (ClientResult<List<String>>) -> Unit)
    fun createSale(sale: SaleDraft, onResult: (ClientResult<Unit>) -> Unit)
    fun ownSales(onResult: (ClientResult<List<SaleRecord>>) -> Unit)
    fun ownInsights(onResult: (ClientResult<ClientInsights>) -> Unit)
}
