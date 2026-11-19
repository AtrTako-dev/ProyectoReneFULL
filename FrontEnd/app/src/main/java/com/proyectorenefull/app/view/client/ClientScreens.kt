package com.proyectorenefull.app.view.client

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.proyectorenefull.app.model.client.ClientInsights
import com.proyectorenefull.app.model.client.PredictionValue
import com.proyectorenefull.app.model.client.SaleRecord
import com.proyectorenefull.app.viewmodel.ClientScreenState
import com.proyectorenefull.app.viewmodel.VentaFormViewModel
import com.proyectorenefull.app.view.components.EmptyStateCard
import com.proyectorenefull.app.view.components.InfoCard
import com.proyectorenefull.app.view.components.LoadingIndicator
import com.proyectorenefull.app.view.components.PrimaryAction
import com.proyectorenefull.app.view.components.ScreenLayout
import com.proyectorenefull.app.view.components.SecondaryAction
import com.proyectorenefull.app.validation.VentaField
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

@Composable
fun PreviewPickerScreen(
    onBack: () -> Unit,
    onChooseClient: () -> Unit,
    onChooseAdmin: () -> Unit
) {
    ScreenLayout(
        title = "Explorar pantallas",
        subtitle = "Estas vistas de desarrollo no representan una sesión real.",
        onBack = onBack
    ) {
        InfoCard("Las opciones permiten revisar el diseño. No cambian permisos ni consultan datos.")
        SecondaryAction("Vista de cliente", onClick = onChooseClient)
        SecondaryAction("Vista de administrador", onClick = onChooseAdmin)
    }
}

@Composable
fun ClientHomeScreen(
    isPreview: Boolean,
    onSale: () -> Unit,
    onOwnSales: () -> Unit,
    onInsights: () -> Unit,
    onExit: () -> Unit
) {
    ScreenLayout(
        title = "Panel de cliente",
        subtitle = "Ventas, estadísticas y estimaciones de demanda",
        onExit = onExit,
        exitLabel = if (isPreview) "Salir de la vista previa" else "Cerrar sesión"
    ) {
        if (isPreview) InfoCard("Vista de cliente sin una sesión ni registros reales.")
        PrimaryAction("Registrar venta", onClick = onSale)
        SecondaryAction("Mis ventas", onClick = onOwnSales)
        SecondaryAction("Estadísticas y predicciones", onClick = onInsights)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SaleFormScreen(
    viewModel: VentaFormViewModel,
    isPreview: Boolean,
    onBack: () -> Unit,
    onExit: () -> Unit
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showDatePicker by remember { mutableStateOf(false) }
    val datePickerState = rememberDatePickerState(initialSelectedDateMillis = state.dateMillis)

    ScreenLayout(
        title = "Registrar venta",
        subtitle = "El servidor valida el producto y asigna su categoría.",
        onBack = onBack,
        onExit = onExit,
        exitLabel = if (isPreview) "Salir de la vista previa" else "Cerrar sesión"
    ) {
        if (isPreview) {
            InfoCard("El formulario de vista previa no envía ventas.")
        } else {
            InfoCard("Usa el ID y el precio del producto del catálogo. La categoría se toma del catálogo del servidor.")
        }
        OutlinedTextField(
            value = state.productId,
            onValueChange = viewModel::updateProductId,
            enabled = !state.isSubmitting && !isPreview,
            label = { Text("ID del producto") },
            singleLine = true,
            isError = state.errors[VentaField.ProductId] != null,
            supportingText = {
                Text(state.errors[VentaField.ProductId] ?: "Formato del catálogo: de 1 a 3 letras y 3 números.")
            },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = state.unitPrice,
            onValueChange = viewModel::updateUnitPrice,
            enabled = !state.isSubmitting && !isPreview,
            label = { Text("Precio unitario (MXN)") },
            singleLine = true,
            isError = state.errors[VentaField.UnitPrice] != null,
            supportingText = { state.errors[VentaField.UnitPrice]?.let { Text(it) } },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = state.quantity,
            onValueChange = viewModel::updateQuantity,
            enabled = !state.isSubmitting && !isPreview,
            label = { Text("Cantidad") },
            singleLine = true,
            isError = state.errors[VentaField.Quantity] != null,
            supportingText = { state.errors[VentaField.Quantity]?.let { Text(it) } },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth()
        )
        SecondaryAction(
            text = state.dateMillis?.let(::formatDate) ?: "Elegir fecha",
            onClick = { showDatePicker = true },
            enabled = !state.isSubmitting && !isPreview
        )
        state.errors[VentaField.Date]?.let {
            Text(it, color = MaterialTheme.colorScheme.error)
        }
        state.message?.let { InfoCard(it, isError = it != "Venta registrada.") }
        PrimaryAction(
            text = if (state.isSubmitting) "Enviando venta…" else if (state.message != null && state.message != "Venta registrada.") "Reintentar registro" else "Registrar venta",
            onClick = viewModel::submit,
            enabled = !isPreview && !state.isSubmitting
        )
        if (state.isSubmitting) LoadingIndicator("Enviando venta")
    }

    if (showDatePicker) {
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.updateDate(datePickerState.selectedDateMillis)
                    showDatePicker = false
                }) { Text("Elegir") }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("Cancelar") }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }
}

@Composable
fun OwnSalesScreen(
    sales: ClientScreenState<List<SaleRecord>>,
    isPreview: Boolean,
    onBack: () -> Unit,
    onExit: () -> Unit,
    onRetry: () -> Unit
) {
    ScreenLayout(
        title = "Mis ventas",
        subtitle = "Solo se consultan los registros de la sesión activa.",
        onBack = onBack,
        onExit = onExit,
        exitLabel = if (isPreview) "Salir de la vista previa" else "Cerrar sesión"
    ) {
        if (isPreview) {
            EmptyStateCard("Vista de diseño", "Las ventas aparecen con una sesión real de cliente.")
        } else when (sales) {
            ClientScreenState.Loading -> LoadingIndicator("Cargando ventas")
            ClientScreenState.Unavailable -> InfoCard("No hay una consulta disponible.", isError = true)
            ClientScreenState.Empty -> EmptyStateCard("Aún no hay ventas", "Las ventas registradas en tu cuenta aparecerán aquí.")
            is ClientScreenState.Error -> {
                InfoCard(sales.message, isError = true)
                PrimaryAction("Reintentar", onClick = onRetry)
            }
            is ClientScreenState.Content -> sales.value.forEach { sale -> SaleCard(sale) }
        }
    }
}

@Composable
private fun SaleCard(sale: SaleRecord) {
    EmptyStateCard(
        title = sale.product,
        message = "${sale.category} · ${formatDate(sale.dateMillis)}\n" +
            "${sale.quantity} unidades · ${formatMxn(sale.totalMxn.toDouble())}"
    )
}

@Composable
fun ClientInsightsScreen(
    insights: ClientScreenState<ClientInsights>,
    isPreview: Boolean,
    onBack: () -> Unit,
    onExit: () -> Unit,
    onRetry: () -> Unit
) {
    ScreenLayout(
        title = "Estadísticas y predicciones",
        subtitle = "Consulta los resultados calculados por el servidor.",
        onBack = onBack,
        onExit = onExit,
        exitLabel = if (isPreview) "Salir de la vista previa" else "Cerrar sesión"
    ) {
        if (isPreview) {
            EmptyStateCard("Vista de diseño", "Las estadísticas aparecen con una sesión real de cliente.")
        } else when (insights) {
            ClientScreenState.Loading -> LoadingIndicator("Cargando estadísticas y predicciones")
            ClientScreenState.Unavailable -> InfoCard("No hay una consulta disponible.", isError = true)
            ClientScreenState.Empty -> EmptyStateCard("Aún no hay registros", "Registra ventas válidas para consultar estadísticas y estimaciones.")
            is ClientScreenState.Error -> {
                InfoCard(insights.message, isError = true)
                PrimaryAction("Reintentar", onClick = onRetry)
            }
            is ClientScreenState.Content -> {
                insights.value.summary.forEach { statistic -> EmptyStateCard(statistic.label, statistic.value) }
                if (insights.value.periods.isNotEmpty()) {
                    Text("Ventas por periodo y categoría", style = MaterialTheme.typography.titleLarge)
                    insights.value.periods.forEach { period ->
                        EmptyStateCard(
                            "${period.label} · ${period.category}",
                            "${period.transactions} transacciones · ${period.units} unidades · ${formatMxn(period.amountMxn.toDouble())}"
                        )
                    }
                }
                Text("Estimaciones", style = MaterialTheme.typography.titleLarge)
                if (insights.value.predictions.isEmpty()) {
                    EmptyStateCard("Sin estimaciones", "El servidor no devolvió predicciones para estos datos.")
                }
                insights.value.predictions.forEach { prediction ->
                    when (prediction) {
                        is PredictionValue.Estimate -> EmptyStateCard(
                            "${prediction.category} · ${prediction.period}",
                            "${prediction.value} ${prediction.unit}. ${prediction.warning} Es una estimación."
                        )
                        is PredictionValue.InsufficientData -> EmptyStateCard(
                            "${prediction.category} · ${prediction.period}", prediction.reason
                        )
                        is PredictionValue.NoReliableEstimate -> EmptyStateCard(
                            "${prediction.category} · ${prediction.period}", prediction.reason
                        )
                    }
                }
            }
        }
    }
}

private fun formatDate(dateMillis: Long): String = SimpleDateFormat("d MMM yyyy", Locale.getDefault()).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}.format(Date(dateMillis))

private fun formatMxn(value: Double): String = NumberFormat.getCurrencyInstance(Locale.forLanguageTag("es-MX")).format(value)
