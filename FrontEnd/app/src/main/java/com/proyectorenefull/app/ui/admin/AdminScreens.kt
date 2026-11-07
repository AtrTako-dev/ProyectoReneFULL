package com.proyectorenefull.app.ui.admin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.proyectorenefull.app.ui.components.EmptyStateCard
import com.proyectorenefull.app.ui.components.InfoCard
import com.proyectorenefull.app.ui.components.PrimaryAction
import com.proyectorenefull.app.ui.components.ScreenLayout
import com.proyectorenefull.app.ui.components.SecondaryAction

@Composable
fun AdminDashboardScreen(isPreview: Boolean, onClients: () -> Unit, onExitPreview: () -> Unit) {
    ScreenLayout(
        title = "Panel de administrador",
        subtitle = "Resumen de estadísticas",
        onExit = onExitPreview
    ) {
        if (isPreview) InfoCard("Vista simulada; no hay sesión ni permisos administrativos reales.")
        StatisticTableSurface()
        StatisticChartSurface()
        SecondaryAction("Lista de clientes", onClick = onClients)
    }
}

@Composable
fun AdminClientsScreen(isPreview: Boolean, onBack: () -> Unit, onExitPreview: () -> Unit) {
    ScreenLayout(
        title = "Clientes",
        subtitle = "La promoción de cuentas se habilitará cuando exista un contrato administrativo.",
        onBack = onBack,
        onExit = onExitPreview
    ) {
        if (isPreview) InfoCard("Vista simulada sin clientes ni permisos administrativos reales.")
        EmptyStateCard(
            title = "Lista no disponible",
            message = "La vista previa no carga clientes y no ofrece acciones de administración."
        )
    }
}

@Composable
private fun StatisticTableSurface() {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text("Tabla de estadísticas", style = MaterialTheme.typography.titleMedium)
        EmptyStateCard(
            title = "Sin datos del servicio",
            message = "Las columnas y filas se definirán con la respuesta acordada del backend."
        )
    }
}

@Composable
private fun StatisticChartSurface() {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text("Gráfica de estadísticas", style = MaterialTheme.typography.titleMedium)
        EmptyStateCard(
            title = "Gráfica pendiente de datos",
            message = "La gráfica usará la misma respuesta validada que la tabla."
        )
    }
}
