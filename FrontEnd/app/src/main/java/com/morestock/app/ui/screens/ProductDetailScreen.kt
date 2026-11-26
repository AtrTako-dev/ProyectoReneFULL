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
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.morestock.app.data.Forecast
import com.morestock.app.data.ForecastMetrics
import com.morestock.app.data.ForecastPoint
import com.morestock.app.data.InventoryItem
import com.morestock.app.data.Product
import com.morestock.app.data.Recommendation
import com.morestock.app.ui.theme.MoreStockTheme
import com.morestock.app.ui.view.components.EmptyState
import com.morestock.app.ui.view.components.ErrorState
import com.morestock.app.ui.view.components.LoadingState
import com.morestock.app.ui.view.components.RecommendationBadge
import com.morestock.app.ui.view.components.RecommendationState
import com.morestock.app.ui.view.components.SyntheticDataBanner

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
                title = { Text("Detalle del producto") },
                navigationIcon = { TextButton(onClick = onBack) { Text("Volver") } },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(product.name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.semantics { heading() })
                Text(
                    listOf(product.category, product.brand, product.unit).filter(String::isNotBlank).joinToString(" · "),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            DetailCard("Inventario actual", inventory?.let { "${formatAmount(it.quantity)} ${it.unit}" }
                ?: product.inventoryQuantity?.let { "${formatAmount(it)} ${product.unit}" }
                ?: "Sin saldo disponible") {
                if (inventory?.synthetic == true) {
                    SyntheticDataBanner(message = "Esta existencia es un dato sintético de demostración.")
                }
            }

            when {
                error != null -> ErrorState(error, onRetry = if (canRetry) onRetry else null)
                isLoading && forecast == null -> LoadingState("Cargando pronóstico…")
                forecast != null -> ForecastContent(forecast)
                else -> EmptyState("El servidor no envió información de pronóstico para este producto.")
            }
            recommendation?.let { RecommendationContent(it) }
        }
    }
}

@Composable
private fun ForecastContent(forecast: Forecast) {
    DetailCard("Demanda estimada", "${formatAmount(forecast.predictedDemand)} ${forecast.unit} en ${forecast.horizonWeeks} semana(s)") {
        Spacer(Modifier.height(8.dp))
        Text("Método: ${forecast.modelName}", style = MaterialTheme.typography.bodyMedium)
        if (forecast.source.isNotBlank()) {
            Text("Fuente informada: ${forecast.source}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (forecast.syntheticData) {
            Spacer(Modifier.height(8.dp))
            SyntheticDataBanner(message = "Este pronóstico usa ventas sintéticas de demostración.")
        }
        ForecastMetricsContent(forecast.metrics, forecast.unit)
        Spacer(Modifier.height(14.dp))
        Text("Historial y pronóstico", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, modifier = Modifier.semantics { heading() })
        when {
            forecast.history.isEmpty() && forecast.weeklyPredictions.isEmpty() -> EmptyState(
                "El servidor no envió puntos históricos ni semanales para graficar."
            )
            else -> {
                ForecastChart(
                    history = forecast.history,
                    forecast = forecast.weeklyPredictions,
                    unit = forecast.unit,
                )
                if (forecast.history.isEmpty()) {
                    Text(
                        "No se recibió historial para comparar; la serie discontinua muestra únicamente el pronóstico.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (forecast.weeklyPredictions.isEmpty()) {
                    Text(
                        "El servidor no envió puntos de pronóstico por semana.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        if (forecast.history.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            ForecastPointList("Datos históricos recibidos", forecast.history, forecast.unit)
        }
        if (forecast.weeklyPredictions.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            ForecastPointList("Pronóstico recibido por semana", forecast.weeklyPredictions, forecast.unit)
        }
    }
}

@Composable
private fun ForecastMetricsContent(metrics: ForecastMetrics?, unit: String) {
    if (metrics == null) {
        Text("El servidor no proporcionó métricas de validación para este pronóstico.", style = MaterialTheme.typography.bodySmall)
        return
    }
    Spacer(Modifier.height(4.dp))
    val details = buildList {
        metrics.mae?.let { add("MAE ${formatAmount(it)} $unit") }
        metrics.wapePercent?.let { add("WAPE ${formatAmount(it)}%") }
        metrics.observations?.let { add("${it} observaciones") }
    }
    Text(
        if (details.isEmpty()) "El servidor no proporcionó valores de validación."
        else "Validación informada: ${details.joinToString(" · ")}",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
private fun ForecastPointList(title: String, points: List<ForecastPoint>, unit: String) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        points.forEach { point ->
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(point.date, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodySmall)
                Text(
                    "${formatAmount(point.demand)} $unit",
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.bodySmall,
                    textAlign = TextAlign.End,
                )
            }
        }
    }
}

@Composable
private fun RecommendationContent(recommendation: Recommendation) {
    DetailCard("Decisión para este producto", "") {
        RecommendationBadge(
            label = recommendation.status.replace('_', ' '),
            state = recommendation.status.toRecommendationState(),
        )
        Spacer(Modifier.height(8.dp))
        if (recommendation.syntheticForecast) {
            SyntheticDataBanner(message = "Esta recomendación se basa en ventas sintéticas de demostración.")
            Spacer(Modifier.height(8.dp))
        }
        Text("Explicación", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        Text(
            recommendation.explanation.ifBlank { "El servidor no envió una explicación para esta recomendación." },
            style = MaterialTheme.typography.bodyMedium,
        )
        Spacer(Modifier.height(12.dp))
        Text("Cifras de planificación", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        DataRow("Inventario actual", recommendation.currentStock, recommendation.unit)
        DataRow("Demanda pronosticada", recommendation.forecastDemand, recommendation.unit)
        DataRow("Demanda para planificación", recommendation.planningDemand, recommendation.unit)
        DataRow("Compra sugerida", recommendation.suggestedQuantity, recommendation.unit)
        DataRow("Inventario objetivo", recommendation.targetStock, recommendation.unit)
        Text("Método: ${recommendation.modelName}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun DataRow(label: String, value: Double, unit: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 5.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            label,
            modifier = Modifier.weight(1f),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            "${formatAmount(value)} $unit",
            modifier = Modifier.weight(1f),
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.End,
        )
    }
}

@Composable
private fun DetailCard(title: String, detail: String, content: @Composable () -> Unit = {}) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            if (detail.isNotBlank()) Text(detail, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
            content()
        }
    }
}

private fun String.toRecommendationState(): RecommendationState = when (uppercase()) {
    "COMPRAR" -> RecommendationState.BUY
    "MANTENER" -> RecommendationState.MAINTAIN
    "NO_COMPRAR", "NO COMPRAR" -> RecommendationState.DO_NOT_BUY
    else -> RecommendationState.UNKNOWN
}

private fun formatAmount(value: Double): String =
    if (value.isFinite() && value % 1.0 == 0.0) value.toLong().toString()
    else if (value.isFinite()) "%.2f".format(value)
    else "sin dato"

@Preview(name = "Producto y pronóstico · demostración", showBackground = true, showSystemUi = true)
@Composable
private fun ProductDetailPreview() {
    MoreStockTheme {
        ProductDetailScreen(
            product = Product("DEMO-01", "Manzana roja", "Frutas", "", "kg", null),
            inventory = InventoryItem("DEMO-01", "Manzana roja", 4.5, "kg", true, "synthetic"),
            recommendation = Recommendation(
                "DEMO-01", "Manzana roja", "kg", 4.5, 8.0, 8.0, 3.5, 9.0,
                "COMPRAR", "El inventario actual está por debajo de la demanda estimada para el periodo.",
                "Modelo de demostración", 1.2, 15.0, true,
            ),
            forecast = Forecast(
                "Manzana roja", "kg", 1, 8.0, "linea-base", true, "synthetic",
                ForecastMetrics(1.2, 15.0, 24),
                listOf(ForecastPoint("2026-10-26", 6.0), ForecastPoint("2026-11-02", 7.0), ForecastPoint("2026-11-09", 6.5)),
                listOf(ForecastPoint("2026-11-16", 8.0), ForecastPoint("2026-11-23", 7.5)),
            ),
            isLoading = false,
            error = null,
            canRetry = false,
            onBack = {},
            onRetry = {},
        )
    }
}
