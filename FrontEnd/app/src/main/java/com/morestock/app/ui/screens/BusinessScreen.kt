package com.morestock.app.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.morestock.app.data.Business
import com.morestock.app.data.InventoryItem
import com.morestock.app.data.Product
import com.morestock.app.data.Recommendation
import com.morestock.app.ui.viewmodel.BusinessTab

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BusinessScreen(
    business: Business,
    products: List<Product>,
    inventory: List<InventoryItem>,
    recommendations: List<Recommendation>,
    selectedTab: BusinessTab,
    isLoading: Boolean,
    error: String?,
    canRetry: Boolean,
    onSelectTab: (BusinessTab) -> Unit,
    onSelectProduct: (String) -> Unit,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(business.name, style = MaterialTheme.typography.titleMedium)
                        Text(business.roleLabel(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.secondary)
                    }
                },
                navigationIcon = { TextButton(onClick = onBack) { Text("Negocios") } },
                actions = { TextButton(onClick = onRefresh, enabled = !isLoading) { Text("Actualizar") } },
            )
        },
        bottomBar = {
            NavigationBar {
                BusinessTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = selectedTab == tab,
                        onClick = { onSelectTab(tab) },
                        icon = { Text(tab.symbol) },
                        label = { Text(tab.label) },
                    )
                }
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 18.dp),
        ) {
            Spacer(Modifier.height(14.dp))
            if (error != null) ErrorCard(error, onRetry = if (canRetry) onRefresh else null)
            if (isLoading) LoadingState("Cargando información del negocio…")
            else when (selectedTab) {
                BusinessTab.SUMMARY -> SummaryContent(products, inventory, recommendations, onSelectProduct)
                BusinessTab.CATALOG -> ProductList(products, onSelectProduct)
                BusinessTab.INVENTORY -> InventoryList(inventory, onSelectProduct)
                BusinessTab.RECOMMENDATIONS -> RecommendationList(recommendations, onSelectProduct)
            }
        }
    }
}

@Composable
private fun SummaryContent(
    products: List<Product>,
    inventory: List<InventoryItem>,
    recommendations: List<Recommendation>,
    onSelectProduct: (String) -> Unit,
) {
    val buyCount = recommendations.count { it.status == "COMPRAR" }
    Text("Resumen", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
    Spacer(Modifier.height(12.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        SummaryCard("Productos", products.size.toString(), Modifier.weight(1f))
        SummaryCard("En inventario", inventory.size.toString(), Modifier.weight(1f))
        SummaryCard("Por comprar", buyCount.toString(), Modifier.weight(1f))
    }
    Spacer(Modifier.height(22.dp))
    Text("Revisar productos", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
    Spacer(Modifier.height(8.dp))
    if (products.isEmpty()) EmptyState("No hay productos disponibles para este negocio.")
    else LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(products.take(6), key = Product::sku) { product ->
            ProductCard(product, inventory.firstOrNull { it.sku == product.sku }, onSelectProduct)
        }
    }
}

@Composable
private fun ProductList(products: List<Product>, onSelectProduct: (String) -> Unit) {
    Text("Catálogo", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
    Spacer(Modifier.height(12.dp))
    if (products.isEmpty()) EmptyState("No hay productos disponibles para este negocio.")
    else LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(products, key = Product::sku) { product -> ProductCard(product, null, onSelectProduct) }
    }
}

@Composable
private fun InventoryList(inventory: List<InventoryItem>, onSelectProduct: (String) -> Unit) {
    Text("Inventario", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
    Spacer(Modifier.height(12.dp))
    if (inventory.isEmpty()) EmptyState("No se encontró inventario para mostrar.")
    else LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(inventory, key = InventoryItem::sku) { item ->
            InfoCard(
                title = item.productName,
                detail = "${formatAmount(item.quantity)} ${item.unit} · ${if (item.synthetic) "referencia sintética" else item.source.ifBlank { "inventario actual" }}",
                onClick = { onSelectProduct(item.sku) },
            )
        }
    }
}

@Composable
private fun RecommendationList(recommendations: List<Recommendation>, onSelectProduct: (String) -> Unit) {
    Text("Recomendaciones", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
    Spacer(Modifier.height(12.dp))
    if (recommendations.isEmpty()) EmptyState("No hay recomendaciones disponibles para este negocio.")
    else LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(recommendations, key = Recommendation::sku) { recommendation ->
            InfoCard(
                title = recommendation.productName,
                detail = listOfNotNull(
                    "${recommendation.status.replace('_', ' ')} · sugerencia: ${formatAmount(recommendation.suggestedQuantity)} ${recommendation.unit}",
                    recommendation.explanation.takeIf(String::isNotBlank),
                    "Pronóstico con datos sintéticos de demostración.".takeIf { recommendation.syntheticForecast },
                ).joinToString(" · "),
                onClick = { onSelectProduct(recommendation.sku) },
            )
        }
    }
}

@Composable
private fun ProductCard(product: Product, inventory: InventoryItem?, onSelectProduct: (String) -> Unit) {
    val stock = inventory?.let { "Inventario: ${formatAmount(it.quantity)} ${it.unit}" }
        ?: product.inventoryQuantity?.let { "Inventario: ${formatAmount(it)} ${product.unit}" }
        ?: "Inventario sin registrar"
    InfoCard(
        title = product.name,
        detail = listOf(product.category, stock).filter(String::isNotBlank).joinToString(" · "),
        onClick = { onSelectProduct(product.sku) },
    )
}

@Composable
private fun SummaryCard(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier, shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
        Column(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
            Text(value, style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.onPrimaryContainer, fontWeight = FontWeight.Bold)
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
        }
    }
}

@Composable
private fun InfoCard(title: String, detail: String, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth().padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(3.dp))
                Text(detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
            }
            Text("›", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary)
        }
    }
}

private val BusinessTab.label: String
    get() = when (this) {
        BusinessTab.SUMMARY -> "Inicio"
        BusinessTab.CATALOG -> "Catálogo"
        BusinessTab.INVENTORY -> "Stock"
        BusinessTab.RECOMMENDATIONS -> "Sugerencias"
    }

private val BusinessTab.symbol: String
    get() = when (this) {
        BusinessTab.SUMMARY -> "⌂"
        BusinessTab.CATALOG -> "▤"
        BusinessTab.INVENTORY -> "▦"
        BusinessTab.RECOMMENDATIONS -> "✦"
    }

private fun formatAmount(value: Double): String = if (value % 1.0 == 0.0) value.toLong().toString() else "%.2f".format(value)
