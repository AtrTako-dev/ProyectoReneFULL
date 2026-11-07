package com.proyectorenefull.app.ui.client

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
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
import com.proyectorenefull.app.BuildConfig
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
        if (BuildConfig.DEBUG && isPreview) {
            InfoCard("Vista de desarrollo: la categoría se escribe para revisar el formulario; la app real la obtendrá del catálogo acordado.")
        }

        OutlinedTextField(
            value = state.product,
            onValueChange = viewModel::updateProduct,
            label = { Text("Producto") },
            singleLine = true,
            isError = state.errors[VentaField.Product] != null,
            supportingText = { state.errors[VentaField.Product]?.let { Text(it) } },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = state.category,
            onValueChange = viewModel::updateCategory,
            label = { Text("Categoría") },
            singleLine = true,
            isError = state.errors[VentaField.Category] != null,
            supportingText = { state.errors[VentaField.Category]?.let { Text(it) } },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = state.unitPrice,
            onValueChange = viewModel::updateUnitPrice,
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
            label = { Text("Cantidad") },
            singleLine = true,
            isError = state.errors[VentaField.Quantity] != null,
            supportingText = { state.errors[VentaField.Quantity]?.let { Text(it) } },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth()
        )
        SecondaryAction(
            text = state.dateMillis?.let(::formatDate) ?: "Elegir fecha",
            onClick = { showDatePicker = true }
        )
        if (state.errors[VentaField.Date] != null) {
            Text(state.errors.getValue(VentaField.Date), color = androidx.compose.material3.MaterialTheme.colorScheme.error)
        }
        if (state.message != null) InfoCard(state.message!!)
        PrimaryAction("Revisar datos", onClick = viewModel::submit)
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
fun OwnSalesScreen(isPreview: Boolean, onBack: () -> Unit, onExitPreview: () -> Unit) {
    ScreenLayout(
        title = "Mis ventas",
        subtitle = "La consulta mostrará únicamente los registros de la sesión activa.",
        onBack = onBack,
        onExit = onExitPreview
    ) {
        if (isPreview) InfoCard("Vista previa sin registros de cuenta.")
        EmptyStateCard(
            title = "Sin registros para mostrar",
            message = "La vista previa no tiene una sesión ni datos de ventas cargados."
        )
    }
}

@Composable
fun ClientInsightsScreen(isPreview: Boolean, onBack: () -> Unit, onExitPreview: () -> Unit) {
    ScreenLayout(
        title = "Estadísticas y predicciones",
        subtitle = "Los resultados se presentarán con su unidad y periodo.",
        onBack = onBack,
        onExit = onExitPreview
    ) {
        if (isPreview) InfoCard("Vista previa sin estadísticas del servicio.")
        EmptyStateCard(
            title = "Estadísticas no disponibles",
            message = "Esta vista previa no consulta registros ni calcula resultados."
        )
        EmptyStateCard(
            title = "Predicción no disponible",
            message = "La estimación y el periodo se mostrarán cuando los entregue el servicio."
        )
    }
}

private fun formatDate(dateMillis: Long): String {
    val formatter = SimpleDateFormat("d MMM yyyy", Locale.getDefault()).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }
    return formatter.format(Date(dateMillis))
}
