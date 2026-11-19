package com.proyectorenefull.app.view.admin

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.proyectorenefull.app.model.admin.AdminCategoryStatistic
import com.proyectorenefull.app.model.admin.AdminStatistics
import com.proyectorenefull.app.model.admin.AdminUser
import com.proyectorenefull.app.viewmodel.AdminUiState
import com.proyectorenefull.app.viewmodel.AdminViewModel
import com.proyectorenefull.app.viewmodel.ClientScreenState
import com.proyectorenefull.app.view.components.EmptyStateCard
import com.proyectorenefull.app.view.components.InfoCard
import com.proyectorenefull.app.view.components.LoadingIndicator
import com.proyectorenefull.app.view.components.PrimaryAction
import com.proyectorenefull.app.view.components.ScreenLayout
import com.proyectorenefull.app.view.components.SecondaryAction
import java.text.NumberFormat
import java.util.Locale

@Composable
fun AdminDashboardScreen(
    viewModel: AdminViewModel,
    isPreview: Boolean,
    onClients: () -> Unit,
    onExit: () -> Unit,
    onRetry: () -> Unit
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ScreenLayout(
        title = "Panel de administrador",
        subtitle = "Estadísticas de ventas entregadas por el servidor",
        onExit = onExit
    ) {
        if (isPreview) {
            EmptyStateCard("Vista de diseño", "El panel muestra estadísticas cuando hay una sesión administrativa real.")
        } else when (val statistics = state.statistics) {
            ClientScreenState.Loading -> LoadingIndicator("Cargando estadísticas")
            ClientScreenState.Unavailable -> InfoCard("No se recibieron estadísticas.", isError = true)
            ClientScreenState.Empty -> EmptyStateCard("Sin ventas registradas", "El servidor no reporta ventas para mostrar.")
            is ClientScreenState.Error -> {
                InfoCard(statistics.message, isError = true)
                PrimaryAction("Reintentar", onClick = onRetry)
            }
            is ClientScreenState.Content -> StatisticsContent(statistics.value)
        }
        SecondaryAction("Lista de clientes", onClick = onClients)
    }
}

@Composable
private fun StatisticsContent(statistics: AdminStatistics) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Resumen · ${statistics.period}", style = MaterialTheme.typography.titleLarge)
        statistics.summary.forEach { (label, value) ->
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(label, style = MaterialTheme.typography.bodyLarge)
                Text(value, style = MaterialTheme.typography.bodyLarge)
            }
        }
    }
    Text("Ventas por categoría", style = MaterialTheme.typography.titleLarge)
    if (statistics.categories.isEmpty()) {
        EmptyStateCard("Sin categorías", "La respuesta no contiene categorías con ventas.")
    } else {
        CategoryTable(statistics.categories, statistics.unit)
        CategoryChart(statistics.categories)
    }
}

@Composable
private fun CategoryTable(categories: List<AdminCategoryStatistic>, unit: String) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Categoría", style = MaterialTheme.typography.labelLarge)
            Text("$unit · MXN", style = MaterialTheme.typography.labelLarge)
        }
        categories.forEach { item ->
            Column(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(item.category, modifier = Modifier.weight(1f))
                    Text("${item.units} · ${formatMxn(item.amountMxn.toDouble())}")
                }
                Text(
                    "${item.transactions} transacciones",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun CategoryChart(categories: List<AdminCategoryStatistic>) {
    val maxAmount = categories.maxOfOrNull { it.amountMxn.toFloat() }?.coerceAtLeast(1f) ?: 1f
    val colors = MaterialTheme.colorScheme
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Importe por categoría (MXN)", style = MaterialTheme.typography.titleMedium)
        categories.forEach { item ->
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(item.category, style = MaterialTheme.typography.bodyMedium)
                    Text(formatMxn(item.amountMxn.toDouble()), style = MaterialTheme.typography.bodyMedium)
                }
                Canvas(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(14.dp)
                        .semantics { contentDescription = "${item.category}: ${formatMxn(item.amountMxn.toDouble())} MXN" }
                ) {
                    drawRoundRect(
                        color = colors.primaryContainer,
                        cornerRadius = androidx.compose.ui.geometry.CornerRadius(7.dp.toPx())
                    )
                    drawRoundRect(
                        color = colors.primary,
                        size = size.copy(width = size.width * (item.amountMxn.toFloat().coerceAtLeast(0f) / maxAmount)),
                        cornerRadius = androidx.compose.ui.geometry.CornerRadius(7.dp.toPx())
                    )
                }
            }
        }
    }
}

@Composable
fun AdminClientsScreen(
    viewModel: AdminViewModel,
    isPreview: Boolean,
    onBack: () -> Unit,
    onExit: () -> Unit,
    onRetry: () -> Unit
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    ScreenLayout(
        title = "Clientes",
        subtitle = "Las cuentas y cambios de rol se confirman con la API.",
        onBack = onBack,
        onExit = onExit
    ) {
        if (isPreview) {
            EmptyStateCard("Vista de diseño", "La lista se carga con una sesión administrativa real.")
        } else {
            state.roleChangeMessage?.let { InfoCard(it, isError = state.roleChangeIsError) }
        }
        if (!isPreview) when (val clients = state.clients) {
            ClientScreenState.Loading -> LoadingIndicator("Cargando clientes")
            ClientScreenState.Unavailable -> InfoCard("No se recibieron cuentas de cliente.", isError = true)
            ClientScreenState.Empty -> EmptyStateCard("No hay clientes", "La API no devolvió cuentas con rol de cliente.")
            is ClientScreenState.Error -> {
                InfoCard(clients.message, isError = true)
                PrimaryAction("Reintentar", onClick = onRetry)
            }
            is ClientScreenState.Content -> clients.value.forEach { client ->
                ClientCard(
                    client = client,
                    isChangingRole = state.changingRoleFor == client.id,
                    canPromote = state.changingRoleFor == null,
                    onPromote = { viewModel.requestPromotion(client) }
                )
            }
        }
    }

    state.pendingPromotion?.let { user ->
        AlertDialog(
            onDismissRequest = viewModel::dismissPromotion,
            title = { Text("Promover a administrador") },
            text = { Text("¿Confirmas que ${user.name} (${user.email}) cambie al rol de administrador?") },
            confirmButton = {
                TextButton(onClick = viewModel::confirmPromotion) { Text("Confirmar") }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissPromotion) { Text("Cancelar") }
            }
        )
    }
}

@Composable
private fun ClientCard(client: AdminUser, isChangingRole: Boolean, canPromote: Boolean, onPromote: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(client.name, style = MaterialTheme.typography.titleMedium)
        Text(client.email, style = MaterialTheme.typography.bodyMedium)
        Text(
            if (client.active) "Cuenta activa" else "Cuenta inactiva",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        SecondaryAction(
            text = if (isChangingRole) "Aplicando cambio…" else "Promover a administrador",
            onClick = onPromote,
            enabled = client.active && canPromote
        )
        if (isChangingRole) LoadingIndicator("Aplicando cambio de rol")
    }
}

private fun formatMxn(value: Double): String = NumberFormat.getCurrencyInstance(Locale.forLanguageTag("es-MX")).format(value)
