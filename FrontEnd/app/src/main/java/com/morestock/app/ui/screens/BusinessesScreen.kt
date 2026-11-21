package com.morestock.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.morestock.app.data.Business
import com.morestock.app.ui.theme.MoreStockSpacing
import com.morestock.app.ui.view.components.EmptyState
import com.morestock.app.ui.view.components.ErrorState
import com.morestock.app.ui.view.components.LoadingState

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun BusinessesScreen(
    email: String,
    businesses: List<Business>,
    isLoading: Boolean,
    error: String?,
    onSelect: (Business) -> Unit,
    onLogout: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("More Stock", style = MaterialTheme.typography.titleLarge) },
                actions = { TextButton(onClick = onLogout) { Text("Salir") } },
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(horizontal = MoreStockSpacing.xLarge, vertical = MoreStockSpacing.large),
            verticalArrangement = Arrangement.spacedBy(MoreStockSpacing.medium),
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(MoreStockSpacing.small)) {
                    Text("Hola, $email", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                    Text("Elige tu negocio", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text(
                        "Selecciona el negocio cuyo inventario quieres consultar.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
            if (error != null) item { ErrorState(error) }
            if (isLoading) {
                item { LoadingState("Cargando negocios…") }
            } else if (businesses.isEmpty()) {
                item { EmptyState("Esta cuenta todavía no tiene negocios asociados.") }
            } else {
                items(businesses, key = Business::id) { business ->
                    BusinessCard(business = business, onClick = { onSelect(business) })
                }
            }
        }
    }
}

@Composable
private fun BusinessCard(business: Business, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
    ) {
        Column(
            modifier = Modifier.padding(MoreStockSpacing.large),
            verticalArrangement = Arrangement.spacedBy(MoreStockSpacing.medium),
        ) {
            Text(business.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Surface(shape = CircleShape, color = MaterialTheme.colorScheme.primaryContainer) {
                Text(
                    text = business.roleLabel(),
                    modifier = Modifier.padding(horizontal = MoreStockSpacing.medium, vertical = MoreStockSpacing.xSmall),
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    style = MaterialTheme.typography.labelLarge,
                )
            }
        }
    }
}

fun Business.roleLabel(): String = when (role) {
    "business_admin" -> "Administrador"
    "employee" -> "Empleado"
    else -> role
}
