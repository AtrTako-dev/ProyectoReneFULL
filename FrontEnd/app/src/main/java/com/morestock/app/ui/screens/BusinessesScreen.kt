package com.morestock.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.morestock.app.data.Business

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
                title = { Text("More Stock") },
                actions = { TextButton(onClick = onLogout) { Text("Salir") } },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp),
        ) {
            Spacer(Modifier.height(22.dp))
            Text("Hola, $email", color = MaterialTheme.colorScheme.secondary)
            Spacer(Modifier.height(5.dp))
            Text("Elige un negocio", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(18.dp))

            if (error != null) ErrorCard(error)
            if (isLoading) {
                LoadingState("Cargando negocios…")
            } else if (businesses.isEmpty()) {
                EmptyState("Esta cuenta todavía no tiene negocios asociados.")
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(businesses, key = Business::id) { business ->
                        BusinessCard(business = business, onClick = { onSelect(business) })
                    }
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
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Row(
            modifier = Modifier.padding(18.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("▦", color = MaterialTheme.colorScheme.primary, fontSize = 28.sp)
            Column(modifier = Modifier.weight(1f).padding(start = 14.dp)) {
                Text(business.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(4.dp))
                Text("${business.id} · ${business.roleLabel()}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
            }
            Text("›", color = MaterialTheme.colorScheme.primary, fontSize = 28.sp)
        }
    }
}

@Composable
fun ErrorCard(message: String) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
        shape = RoundedCornerShape(14.dp),
    ) {
        Text(message, modifier = Modifier.padding(14.dp), color = MaterialTheme.colorScheme.onErrorContainer)
    }
}

@Composable
fun LoadingState(message: String) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 36.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        CircularProgressIndicator()
        Text(message, color = MaterialTheme.colorScheme.secondary)
    }
}

@Composable
fun EmptyState(message: String) {
    Text(message, modifier = Modifier.fillMaxWidth().padding(vertical = 28.dp), color = MaterialTheme.colorScheme.secondary)
}

fun Business.roleLabel(): String = when (role) {
    "business_admin" -> "Administrador"
    "employee" -> "Empleado"
    else -> role
}
