package com.morestock.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import com.morestock.app.data.Business
import com.morestock.app.ui.theme.MoreStockSpacing

@Composable
internal fun ProfilePanel(
    email: String,
    business: Business,
    onChangeBusiness: () -> Unit,
    onRequestLogout: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(MoreStockSpacing.medium)) {
        Text("Cuenta", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.semantics { heading() })
        Card(modifier = Modifier.fillMaxWidth(), shape = MaterialTheme.shapes.medium) {
            Column(modifier = Modifier.padding(MoreStockSpacing.large), verticalArrangement = Arrangement.spacedBy(MoreStockSpacing.xSmall)) {
                Text("Correo", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(email, style = MaterialTheme.typography.bodyLarge)
            }
        }
        Card(modifier = Modifier.fillMaxWidth(), shape = MaterialTheme.shapes.medium) {
            Column(modifier = Modifier.padding(MoreStockSpacing.large), verticalArrangement = Arrangement.spacedBy(MoreStockSpacing.xSmall)) {
                Text("Negocio activo", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(business.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                Text(business.roleLabel(), style = MaterialTheme.typography.bodyMedium)
            }
        }
        OutlinedButton(onClick = onChangeBusiness, modifier = Modifier.fillMaxWidth()) {
            Text("Cambiar de negocio")
        }
        Button(onClick = onRequestLogout, modifier = Modifier.fillMaxWidth()) {
            Text("Cerrar sesión")
        }
    }
}

@Composable
internal fun ConfirmLogoutDialog(
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("¿Cerrar sesión?") },
        text = { Text("Tendrás que volver a iniciar sesión para consultar tus negocios.") },
        confirmButton = { TextButton(onClick = onConfirm) { Text("Cerrar sesión") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
    )
}
