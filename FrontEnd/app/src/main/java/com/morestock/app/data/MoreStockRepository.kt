package com.morestock.app.data

interface MoreStockDataSource {
    suspend fun login(email: String, password: String): UserSession
    suspend fun logout(token: String)
    suspend fun getBusinesses(token: String): List<Business>
    suspend fun getProducts(token: String, businessId: String): List<Product>
    suspend fun getInventory(token: String, businessId: String): List<InventoryItem>
    suspend fun updateInventory(
        token: String,
        businessId: String,
        productId: String,
        quantity: Double,
        unit: String,
        note: String? = null,
    ): InventoryItem
    suspend fun getRecommendations(token: String, businessId: String): List<Recommendation>
    suspend fun getForecast(token: String, businessId: String, productId: String): Forecast
}

class MoreStockRepository(private val api: MoreStockApi) : MoreStockDataSource {
    override suspend fun login(email: String, password: String) = api.login(email, password)
    override suspend fun logout(token: String) = api.logout(token)
    override suspend fun getBusinesses(token: String) = api.getBusinesses(token)
    override suspend fun getProducts(token: String, businessId: String) = api.getProducts(token, businessId)
    override suspend fun getInventory(token: String, businessId: String) = api.getInventory(token, businessId)
    override suspend fun updateInventory(
        token: String,
        businessId: String,
        productId: String,
        quantity: Double,
        unit: String,
        note: String?,
    ) = api.updateInventory(token, businessId, productId, quantity, unit, note)
    override suspend fun getRecommendations(token: String, businessId: String) = api.getRecommendations(token, businessId)
    override suspend fun getForecast(token: String, businessId: String, productId: String) =
        api.getForecast(token, businessId, productId)
}
