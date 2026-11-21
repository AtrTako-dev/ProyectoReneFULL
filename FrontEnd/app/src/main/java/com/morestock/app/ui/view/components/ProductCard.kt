package com.morestock.app.ui.view.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.morestock.app.ui.theme.MoreStockSpacing

data class ProductRecommendation(
    val label: String,
    val state: RecommendationState,
)

@Composable
fun ProductCard(
    name: String,
    stockLabel: String,
    modifier: Modifier = Modifier,
    category: String? = null,
    isSynthetic: Boolean = false,
    recommendation: ProductRecommendation? = null,
    onClick: (() -> Unit)? = null,
) {
    val cardModifier = modifier.fillMaxWidth()
    val colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    if (onClick == null) {
        Card(modifier = cardModifier, shape = MaterialTheme.shapes.medium, colors = colors) {
            ProductCardContent(name, stockLabel, category, isSynthetic, recommendation)
        }
    } else {
        Card(
            onClick = onClick,
            modifier = cardModifier,
            shape = MaterialTheme.shapes.medium,
            colors = colors,
        ) {
            ProductCardContent(name, stockLabel, category, isSynthetic, recommendation)
        }
    }
}

@Composable
private fun ProductCardContent(
    name: String,
    stockLabel: String,
    category: String?,
    isSynthetic: Boolean,
    recommendation: ProductRecommendation?,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(MoreStockSpacing.large),
        verticalArrangement = Arrangement.spacedBy(MoreStockSpacing.small),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(MoreStockSpacing.medium),
            verticalAlignment = Alignment.Top,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(name, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurface)
                if (!category.isNullOrBlank()) {
                    Text(category, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            recommendation?.let { RecommendationBadge(it.label, it.state) }
        }
        Text(stockLabel, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface)
        if (isSynthetic) SyntheticDataBanner()
    }
}
