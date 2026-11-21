package com.morestock.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.morestock.app.data.Forecast
import com.morestock.app.data.InventoryItem
import com.morestock.app.data.Product
import com.morestock.app.data.Recommendation
import com.morestock.app.ui.view.components.EmptyState
import com.morestock.app.ui.view.components.ErrorState
import com.morestock.app.ui.view.components.LoadingState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductDetailScreen(
    product: Product,
    inventory: InventoryItem?,
    recommendation: Recommendation?,
    forecast: Forecast?,
    isLoading: Boolean,
    error: String?,
    canRetry: Boolean,
    onBack: () -> Unit,
    onRetry: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Producto") },
                navigationIcon = { TextButton(onClick = onBack) { Text("Volver") } },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 12.dp),
        ) {
            Text(product.name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(5.dp))
            Text(listOf(product.category, product.brand, product.unit).filter(String::isNotBlank).joinToString(" · "), color = MaterialTheme.colorScheme.secondary)
            Spacer(Modifier.height(18.dp))
            if (error != null) ErrorState(error, onRetry = if (canRetry) onRetry else null)
            DetailCard("Inventario", inventory?.let { "${formatAmount(it.quantity)} ${it.unit}" } ?: product.inventoryQuantity?.let { "${formatAmount(it)} ${product.unit}" } ?: "Sin saldo disponible") {
                if (inventory?.synthetic == true) Text("Dato de referencia sintético", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
            }
            Spacer(Modifier.height(12.dp))
            when {
                isLoading && forecast == null -> LoadingState("Cargando pronóstico…")
                forecast != null -> ForecastContent(forecast)
                else -> EmptyState("No se pudo cargar el pronóstico de este producto.")
            }
            Spacer(Modifier.height(12.dp))
            recommendation?.let { RecommendationContent(it) }
        }
    }
}

@Composable
private fun ForecastContent(forecast: Forecast) {
    DetailCard("Pronóstico", "${formatAmount(forecast.predictedDemand)} ${forecast.unit} en ${forecast.horizonWeeks} semana(s)") {
        Spacer(Modifier.height(7.dp))
        Text("Método: ${forecast.modelName}", style = MaterialTheme.typography.bodySmall)
        if (forecast.syntheticData) Text("Basado en datos sintéticos de demostración.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
        forecast.metrics?.let { metrics ->
            val mae = metrics.mae?.let(::formatAmount) ?: "sin dato"
            val wape = metrics.wapePercent?.let { "${formatAmount(it)}%" } ?: "sin dato"
            Text("Validación: MAE $mae · WAPE $wape", style = MaterialTheme.typography.bodySmall)
        }
        if (forecast.weeklyPredictions.isNotEmpty()) {
            Spacer(Modifier.height(10.dp))
            Text("Pronóstico por semana", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            forecast.weeklyPredictions.forEach { point ->
                Row(modifier = Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(point.date, style = MaterialTheme.typography.bodySmall)
                    Text("${formatAmount(point.demand)} ${forecast.unit}", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        if (forecast.history.isNotEmpty()) {
            Spacer(Modifier.height(10.dp))
            Text("Últimas semanas registradas", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            forecast.history.takeLast(4).forEach { point ->
                Row(modifier = Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(point.date, style = MaterialTheme.typography.bodySmall)
                    Text("${formatAmount(point.demand)} ${forecast.unit}", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun RecommendationContent(recommendation: Recommendation) {
    DetailCard("Recomendación: ${recommendation.status.replace('_', ' ')}", recommendation.explanation.ifBlank { "Sin explicación disponible." }) {
        Spacer(Modifier.height(9.dp))
        Text("Compra sugerida: ${formatAmount(recommendation.suggestedQuantity)} ${recommendation.unit}", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
        Text("Inventario objetivo: ${formatAmount(recommendation.targetStock)} ${recommendation.unit}", style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun DetailCard(title: String, detail: String, content: @Composable () -> Unit = {}) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(5.dp))
            Text(detail, style = MaterialTheme.typography.bodyMedium)
            content()
        }
    }
}

private fun formatAmount(value: Double): String = if (value % 1.0 == 0.0) value.toLong().toString() else "%.2f".format(value)
