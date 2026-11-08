package com.proyectorenefull.app.data.client

import com.proyectorenefull.app.domain.client.ClientInsights
import com.proyectorenefull.app.domain.client.ClientRepository
import com.proyectorenefull.app.domain.client.ClientResult
import com.proyectorenefull.app.domain.client.SaleDraft
import com.proyectorenefull.app.domain.client.SaleRecord

class UnavailableClientRepository : ClientRepository {
    override fun categories(onResult: (ClientResult<List<String>>) -> Unit) {
        onResult(ClientResult.Unavailable)
    }

    override fun createSale(sale: SaleDraft, onResult: (ClientResult<Unit>) -> Unit) {
        onResult(ClientResult.Unavailable)
    }

    override fun ownSales(onResult: (ClientResult<List<SaleRecord>>) -> Unit) {
        onResult(ClientResult.Unavailable)
    }

    override fun ownInsights(onResult: (ClientResult<ClientInsights>) -> Unit) {
        onResult(ClientResult.Unavailable)
    }
}
