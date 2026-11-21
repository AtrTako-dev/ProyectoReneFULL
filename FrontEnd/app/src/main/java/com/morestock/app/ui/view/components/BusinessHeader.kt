package com.morestock.app.ui.view.components

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BusinessHeader(
    businessName: String,
    roleLabel: String,
    modifier: Modifier = Modifier,
    onBack: (() -> Unit)? = null,
    onRefresh: (() -> Unit)? = null,
    isLoading: Boolean = false,
) {
    TopAppBar(
        modifier = modifier,
        title = {
            Column {
                Text(
                    text = businessName,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = roleLabel,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        },
        navigationIcon = {
            if (onBack != null) TextButton(onClick = onBack) { Text("Negocios") }
        },
        actions = {
            if (onRefresh != null) {
                TextButton(onClick = onRefresh, enabled = !isLoading) {
                    Text(if (isLoading) "Cargando" else "Actualizar")
                }
            }
        },
    )
}
