package com.morestock.app.ui.screens

import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.morestock.app.data.InventoryItem
import com.morestock.app.domain.validation.InventoryQuantityRules
import com.morestock.app.ui.theme.MoreStockTheme
import com.morestock.app.ui.view.components.ValidatedTextField

@Composable
internal fun InventoryEditDialog(
    item: InventoryItem,
    latestItem: InventoryItem?,
    isProcessing: Boolean,
    isCheckingLatest: Boolean,
    error: String?,
    onDismiss: () -> Unit,
    onSave: (Double, String, Double, String) -> Unit,
    onClearError: () -> Unit,
) {
    var value by rememberSaveable(item.sku, item.quantity) { mutableStateOf(formatQuantity(item.quantity)) }
    var editingUnit by rememberSaveable(item.sku, item.unit) { mutableStateOf(item.unit) }
    var touched by rememberSaveable(item.sku) { mutableStateOf(false) }
    var submitted by rememberSaveable(item.sku) { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }
    LaunchedEffect(Unit) { focusRequester.requestFocus() }

    val validationError = InventoryQuantityRules.error(value, editingUnit).takeIf { touched || submitted }
    val changedWhileEditing = latestItem != null &&
        (latestItem.quantity != item.quantity || latestItem.unit != item.unit)
    val unitNeedsConfirmation = latestItem != null && latestItem.unit != item.unit && editingUnit != latestItem.unit

    fun submit() {
        submitted = true
        val currentItem = latestItem ?: return
        if (isProcessing || unitNeedsConfirmation) return
        val quantity = InventoryQuantityRules.parse(value, editingUnit) ?: return
        onClearError()
        onSave(quantity, editingUnit, currentItem.quantity, currentItem.unit)
    }

    AlertDialog(
        onDismissRequest = { if (!isProcessing) onDismiss() },
        title = { Text("Editar inventario") },
        text = {
            Column(
                modifier = Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(item.productName, style = MaterialTheme.typography.titleMedium)
                Text(
                    "Actualiza la cantidad. La unidad se conserva y no se convierte.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                when {
                    latestItem == null -> Text(
                        "El producto ya no tiene una existencia registrada. No se puede guardar este cambio.",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Assertive },
                    )
                    changedWhileEditing -> Text(
                        "La existencia registrada cambió a ${formatQuantity(latestItem.quantity)} ${latestItem.unit}. Tu cantidad escrita se conserva; revísala antes de guardarla.",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    )
                }
                latestItem?.takeIf { unitNeedsConfirmation }?.let { currentItem ->
                    Text(
                        "La unidad cambió. Confirma la unidad actual para conservar el número sin convertirlo.",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                    )
                    TextButton(onClick = { editingUnit = currentItem.unit }, enabled = !isProcessing) {
                        Text("Usar unidad ${currentItem.unit}")
                    }
                }
                ValidatedTextField(
                    value = value,
                    onValueChange = {
                        value = it
                        touched = true
                        if (error != null) onClearError()
                    },
                    label = "Existencia",
                    errorMessage = validationError,
                    enabled = !isProcessing,
                    modifier = Modifier.focusRequester(focusRequester),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal, imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { submit() }),
                    trailingIcon = { Text(editingUnit, modifier = Modifier.padding(end = 8.dp)) },
                )
                if (error != null && validationError == null) {
                    Text(
                        error,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Assertive },
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { submit() },
                enabled = !isProcessing && latestItem != null && !unitNeedsConfirmation,
            ) {
                if (isProcessing) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                            strokeWidth = 2.dp,
                        )
                        Text(if (isCheckingLatest) "Verificando inventario" else "Guardando")
                    }
                } else {
                    Text(if (changedWhileEditing) "Guardar mi cantidad" else "Guardar")
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !isProcessing) { Text("Cancelar") }
        },
    )
}

private fun formatQuantity(value: Double): String =
    if (value.isFinite()) java.math.BigDecimal.valueOf(value).stripTrailingZeros().toPlainString() else value.toString()

@Preview(name = "Editar inventario · datos de demostración", showBackground = true)
@Composable
private fun InventoryEditDialogPreview() {
    MoreStockTheme {
        InventoryEditDialog(
            item = InventoryItem("DEMO-01", "Manzana roja", 4.5, "kg", true, "synthetic"),
            latestItem = InventoryItem("DEMO-01", "Manzana roja", 5.0, "kg", true, "synthetic"),
            isProcessing = false,
            isCheckingLatest = false,
            error = null,
            onDismiss = {},
            onSave = { _, _, _, _ -> },
            onClearError = {},
        )
    }
}
