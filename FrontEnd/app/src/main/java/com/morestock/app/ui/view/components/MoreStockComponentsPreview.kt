package com.morestock.app.ui.view.components

import android.content.res.Configuration
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.morestock.app.ui.theme.MoreStockTheme
import com.morestock.app.ui.theme.MoreStockSpacing

@Preview(name = "Componentes · claro", showBackground = true, widthDp = 360)
@Composable
private fun MoreStockComponentsLightPreview() {
    MoreStockTheme(darkTheme = false) { MoreStockComponentsPreviewContent() }
}

@Preview(
    name = "Componentes · oscuro",
    showBackground = true,
    widthDp = 360,
    uiMode = Configuration.UI_MODE_NIGHT_YES,
)
@Composable
private fun MoreStockComponentsDarkPreview() {
    MoreStockTheme(darkTheme = true) { MoreStockComponentsPreviewContent() }
}

@Composable
private fun MoreStockComponentsPreviewContent() {
    Surface(color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier
                .verticalScroll(rememberScrollState())
                .padding(MoreStockSpacing.large),
            verticalArrangement = Arrangement.spacedBy(MoreStockSpacing.medium),
        ) {
            BusinessHeader(
                businessName = "Abarrotes La Esquina",
                roleLabel = "Administrador",
                onBack = {},
                onRefresh = {},
            )
            Text("Estados de recomendación", style = MaterialTheme.typography.titleMedium)
            RecommendationBadge("COMPRAR", RecommendationState.BUY)
            RecommendationBadge("MANTENER", RecommendationState.MAINTAIN)
            RecommendationBadge("NO COMPRAR", RecommendationState.DO_NOT_BUY)
            MetricCard("Productos", "24", modifier = Modifier.fillMaxWidth(), detail = "En el catálogo")
            ProductCard(
                name = "Pan de caja",
                category = "Panadería",
                stockLabel = "Inventario: 12 piezas",
                isSynthetic = true,
                recommendation = ProductRecommendation("COMPRAR", RecommendationState.BUY),
                onClick = {},
            )
            ValidatedTextField(value = "", onValueChange = {}, label = "Correo electrónico")
            ValidatedTextField(
                value = "correo inválido",
                onValueChange = {},
                label = "Correo electrónico",
                errorMessage = "Escribe un correo válido.",
            )
            PrimaryActionButton("Guardar", onClick = {}, modifier = Modifier.fillMaxWidth())
            PrimaryActionButton("Guardar", onClick = {}, modifier = Modifier.fillMaxWidth(), isLoading = true)
            SecondaryActionButton("Cancelar", onClick = {}, modifier = Modifier.fillMaxWidth())
            LoadingState("Cargando productos…")
            EmptyState("Todavía no hay productos para mostrar.")
            ErrorState("No se pudo conectar con el servidor.", onRetry = {})
            SyntheticDataBanner()
        }
    }
}
