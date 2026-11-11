package com.proyectorenefull.app.ui.client

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.proyectorenefull.app.domain.client.ClientInsights
import com.proyectorenefull.app.domain.client.PredictionValue
import com.proyectorenefull.app.domain.client.SaleRecord
import com.proyectorenefull.app.ui.ClientScreenState
import com.proyectorenefull.app.ui.VentaFormViewModel
import com.proyectorenefull.app.ui.components.EmptyStateCard
import com.proyectorenefull.app.ui.components.InfoCard
import com.proyectorenefull.app.ui.components.PrimaryAction
import com.proyectorenefull.app.ui.components.ScreenLayout
import com.proyectorenefull.app.ui.components.SecondaryAction
import com.proyectorenefull.app.validation.VentaField
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
        InfoCard("Las opciones siguientes solo permiten revisar el diseño. No cambian permisos ni consultan datos.")
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
    onExitPreview: () -> Unit
) {
    ScreenLayout(
        title = "Panel de cliente",
        subtitle = "Ventas, estadísticas y estimaciones de demanda",
        onExit = onExitPreview
    ) {
        if (isPreview) InfoCard("Sesión simulada de cliente; no existe una cuenta ni permisos reales.")
        PrimaryAction("Registrar venta", onClick = onSale)
        SecondaryAction("Mis ventas", onClick = onOwnSales)
        SecondaryAction("Estadísticas y predicciones", onClick = onInsights)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SaleFormScreen(
    viewModel: VentaFormViewModel,
    categories: ClientScreenState<List<String>>,
    isPreview: Boolean,
    onBack: () -> Unit,
    onExitPreview: () -> Unit
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showDatePicker by remember { mutableStateOf(false) }
    val datePickerState = rememberDatePickerState(initialSelectedDateMillis = state.dateMillis)

    ScreenLayout(
        title = "Registrar venta",
        subtitle = "Completa los datos de la venta.",
        onBack = onBack,
        onExit = onExitPreview
    ) {
        if (isPreview) InfoCard("Esta vista no guarda ventas sin el servicio de ventas.")

        OutlinedTextField(
            value = state.product,
            onValueChange = viewModel::updateProduct,
            enabled = !state.isSubmitting,
            label = { Text("Producto") },
            singleLine = true,
            isError = state.errors[VentaField.Product] != null,
            supportingText = { state.errors[VentaField.Product]?.let { Text(it) } },
            modifier = Modifier.fillMaxWidth()
        )
        Box {
            var expanded by remember { mutableStateOf(false) }
            val options = when (categories) {
                is ClientScreenState.Content -> categories.value
                else -> emptyList()
            }
            SecondaryAction(
                text = if (state.category.isBlank()) "Elegir categoría" else state.category,
                onClick = { expanded = true },
                enabled = options.isNotEmpty() && !state.isSubmitting
            )
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                options.forEach { category ->
                    DropdownMenuItem(text = { Text(category) }, onClick = {
                        viewModel.updateCategory(category)
                        expanded = false
                    })
                }
            }
        }
        when (categories) {
            ClientScreenState.Loading -> CircularProgressIndicator()
            ClientScreenState.Unavailable -> InfoCard("El catálogo de categorías aún no está disponible.")
            ClientScreenState.Empty -> InfoCard("El catálogo no contiene categorías disponibles.")
            is ClientScreenState.Error -> InfoCard("No se pudo cargar el catálogo.", isError = true)
            is ClientScreenState.Content -> Unit
        }
        state.errors[VentaField.Category]?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        OutlinedTextField(
            value = state.unitPrice,
            onValueChange = viewModel::updateUnitPrice,
            enabled = !state.isSubmitting,
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
            enabled = !state.isSubmitting,
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
            enabled = !state.isSubmitting
        )
        if (state.errors[VentaField.Date] != null) {
            Text(state.errors.getValue(VentaField.Date), color = androidx.compose.material3.MaterialTheme.colorScheme.error)
        }
        if (state.message != null) InfoCard(state.message!!)
        PrimaryAction(
            "Registrar venta",
            onClick = viewModel::submit,
            enabled = categories is ClientScreenState.Content && !state.isSubmitting
        )
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
    onExitPreview: () -> Unit
) {
    ScreenLayout(
        title = "Mis ventas",
        subtitle = "La consulta mostrará únicamente los registros de la sesión activa.",
        onBack = onBack,
        onExit = onExitPreview
    ) {
        if (isPreview) InfoCard("Vista de desarrollo sin registros de una cuenta real.")
        when (sales) {
            ClientScreenState.Loading -> CircularProgressIndicator()
            ClientScreenState.Unavailable -> InfoCard("La consulta de ventas propias aún no está disponible.")
            ClientScreenState.Empty -> EmptyStateCard("Aún no hay ventas", "Las ventas registradas aparecerán aquí.")
            is ClientScreenState.Error -> InfoCard("No se pudieron cargar las ventas.", isError = true)
            is ClientScreenState.Content -> sales.value.forEach { sale ->
                EmptyStateCard(
                    title = sale.product,
                    message = "${sale.category} · ${formatDate(sale.dateMillis)} · ${sale.quantity} unidades · ${sale.totalMxn} MXN"
                )
            }
        }
    }
}

@Composable
fun ClientInsightsScreen(
    insights: ClientScreenState<ClientInsights>,
    isPreview: Boolean,
    onBack: () -> Unit,
    onExitPreview: () -> Unit
) {
    ScreenLayout(
        title = "Estadísticas y predicciones",
        subtitle = "Los resultados se presentarán con su unidad y periodo.",
        onBack = onBack,
        onExit = onExitPreview
    ) {
        if (isPreview) InfoCard("Vista de desarrollo sin estadísticas ni predicciones reales.")
        when (insights) {
            ClientScreenState.Loading -> CircularProgressIndicator()
            ClientScreenState.Unavailable -> InfoCard("La consulta de estadísticas y predicciones aún no está disponible.")
            ClientScreenState.Empty -> EmptyStateCard("Sin datos suficientes", "Registra ventas para consultar resultados cuando el servicio esté disponible.")
            is ClientScreenState.Error -> InfoCard("No se pudieron cargar los resultados.", isError = true)
            is ClientScreenState.Content -> {
                insights.value.statistics.forEach { statistic ->
                    EmptyStateCard(statistic.label, statistic.value)
                }
                when (val prediction = insights.value.prediction) {
                    is PredictionValue.Estimate -> EmptyStateCard(
                        "Estimación de demanda",
                        "${prediction.value} ${prediction.unit} para ${prediction.period}. Es una estimación."
                    )
                    PredictionValue.InsufficientData -> EmptyStateCard(
                        "Sin base suficiente",
                        "No hay datos suficientes para generar una estimación."
                    )
                }
            }
        }
    }
}

private fun formatDate(dateMillis: Long): String {
    val formatter = SimpleDateFormat("d MMM yyyy", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    return formatter.format(Date(dateMillis))
}
