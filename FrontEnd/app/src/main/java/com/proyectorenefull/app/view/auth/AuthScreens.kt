package com.proyectorenefull.app.view.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.proyectorenefull.app.viewmodel.AuthViewModel
import com.proyectorenefull.app.view.components.InfoCard
import com.proyectorenefull.app.view.components.LoadingIndicator
import com.proyectorenefull.app.view.components.ScreenLayout
import com.proyectorenefull.app.view.components.SecondaryAction

@Composable
fun LoginScreen(
    viewModel: AuthViewModel,
    onRegister: (() -> Unit)?,
    onPreview: (() -> Unit)?
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    ScreenLayout(
        title = "PronoVenta",
        subtitle = "Análisis de ventas y demanda"
    ) {
        Text("Inicia sesión para consultar tu espacio de trabajo.")
        if (state.isRestoringSession) LoadingIndicator("Restaurando sesión")
        OutlinedTextField(
            value = state.email,
            onValueChange = viewModel::updateEmail,
            enabled = !state.isSubmitting,
            label = { Text("Correo electrónico") },
            singleLine = true,
            isError = state.emailError != null,
            supportingText = { state.emailError?.let { Text(it) } },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = state.password,
            onValueChange = viewModel::updatePassword,
            enabled = !state.isSubmitting,
            label = { Text("Contraseña") },
            singleLine = true,
            isError = state.passwordError != null,
            supportingText = { state.passwordError?.let { Text(it) } },
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth()
        )
        state.feedback?.let { InfoCard(it.message, isError = it.isError) }
        AuthSubmitButton("Iniciar sesión", state.isSubmitting || state.isRestoringSession, viewModel::submitLogin)
        if (onRegister != null) {
            TextButton(onClick = onRegister, enabled = !state.isSubmitting && !state.isRestoringSession, modifier = Modifier.fillMaxWidth()) {
                Text("Crear cuenta de cliente")
            }
        }
        if (onPreview != null) SecondaryAction(
            "Explorar pantallas de diseño",
            onClick = onPreview,
            enabled = !state.isSubmitting
        )
    }
}

@Composable
fun RegisterScreen(viewModel: AuthViewModel, onBack: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    ScreenLayout(
        title = "Crear cuenta",
        subtitle = "El registro público crea una cuenta de cliente.",
        onBack = onBack
    ) {
        OutlinedTextField(
            value = state.name,
            onValueChange = viewModel::updateName,
            enabled = !state.isSubmitting,
            label = { Text("Nombre") },
            singleLine = true,
            isError = state.nameError != null,
            supportingText = { state.nameError?.let { Text(it) } },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = state.email,
            onValueChange = viewModel::updateEmail,
            enabled = !state.isSubmitting,
            label = { Text("Correo electrónico") },
            singleLine = true,
            isError = state.emailError != null,
            supportingText = { state.emailError?.let { Text(it) } },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = state.password,
            onValueChange = viewModel::updatePassword,
            enabled = !state.isSubmitting,
            label = { Text("Contraseña") },
            singleLine = true,
            isError = state.passwordError != null,
            supportingText = { state.passwordError?.let { Text(it) } },
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth()
        )
        state.feedback?.let { InfoCard(it.message, isError = it.isError) }
        AuthSubmitButton("Crear cuenta", state.isSubmitting, viewModel::submitRegistration)
    }
}

@Composable
private fun AuthSubmitButton(label: String, isSubmitting: Boolean, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = !isSubmitting,
        modifier = Modifier.fillMaxWidth()
    ) {
        if (isSubmitting) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                Text("Procesando")
            }
        } else {
            Text(label)
        }
    }
}
