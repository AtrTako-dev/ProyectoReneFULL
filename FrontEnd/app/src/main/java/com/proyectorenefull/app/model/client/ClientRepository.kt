package com.proyectorenefull.app.model.client

interface ClientRepository {
    fun createSale(sale: SaleDraft, onResult: (ClientResult<Unit>) -> Unit)
    fun ownSales(onResult: (ClientResult<List<SaleRecord>>) -> Unit)
    fun ownInsights(onResult: (ClientResult<ClientInsights>) -> Unit)
}
