package com.morestock.app.ui.screens

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.morestock.app.ui.validation.AuthFormValidation
import com.morestock.app.ui.view.components.ErrorState
import com.morestock.app.ui.view.components.PrimaryActionButton
import com.morestock.app.ui.view.components.ValidatedTextField

@Composable
fun RegistrationScreen(
    isLoading: Boolean,
    error: String?,
    authRetryAfterSeconds: Long?,
    onRegister: (String, String, String) -> Unit,
    onBackToLogin: () -> Unit,
    onClearError: () -> Unit,
) {
    var businessName by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var businessTouched by rememberSaveable { mutableStateOf(false) }
    var emailTouched by rememberSaveable { mutableStateOf(false) }
    var passwordTouched by rememberSaveable { mutableStateOf(false) }
    var submitted by rememberSaveable { mutableStateOf(false) }
    var passwordVisible by rememberSaveable { mutableStateOf(false) }
    val businessFocus = remember { FocusRequester() }
    val emailFocus = remember { FocusRequester() }
    val passwordFocus = remember { FocusRequester() }
    val businessError = AuthFormValidation.businessNameError(businessName).takeIf { businessTouched || submitted }
    val emailError = AuthFormValidation.emailError(email).takeIf { emailTouched || submitted }
    val passwordError = AuthFormValidation.passwordError(password).takeIf { passwordTouched || submitted }
    val isValid = AuthFormValidation.businessNameError(businessName) == null &&
        AuthFormValidation.emailError(email) == null &&
        AuthFormValidation.passwordError(password) == null

    fun submit() {
        submitted = true
        if (isValid && !isLoading) onRegister(email.trim(), password, businessName.trim())
    }

    AuthScreenLayout(
        heading = "Crear cuenta",
        description = "Registra tu negocio para comenzar.",
    ) {
        ValidatedTextField(
            value = businessName,
            onValueChange = {
                businessName = it
                businessTouched = true
                onClearError()
            },
            label = "Nombre del negocio",
            modifier = Modifier.focusRequester(businessFocus),
            errorMessage = businessError,
            enabled = !isLoading,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text, imeAction = ImeAction.Next),
            keyboardActions = KeyboardActions(onNext = { emailFocus.requestFocus() }),
        )
        ValidatedTextField(
            value = email,
            onValueChange = {
                email = it
                emailTouched = true
                onClearError()
            },
            label = "Correo electrónico",
            modifier = Modifier.focusRequester(emailFocus),
            errorMessage = emailError,
            enabled = !isLoading,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
            keyboardActions = KeyboardActions(onNext = { passwordFocus.requestFocus() }),
        )
        ValidatedTextField(
            value = password,
            onValueChange = {
                password = it
                passwordTouched = true
                onClearError()
            },
            label = "Contraseña",
            modifier = Modifier.focusRequester(passwordFocus),
            errorMessage = passwordError,
            enabled = !isLoading,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { submit() }),
            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
            trailingIcon = {
                TextButton(onClick = { passwordVisible = !passwordVisible }, enabled = !isLoading) {
                    Text(if (passwordVisible) "Ocultar" else "Mostrar")
                }
            },
        )
        Text(
            text = "La contraseña debe tener al menos 8 caracteres. Se creará una cuenta administradora para este negocio.",
            color = androidx.compose.material3.MaterialTheme.colorScheme.onSurfaceVariant,
            style = androidx.compose.material3.MaterialTheme.typography.bodySmall,
        )
        when {
            authRetryAfterSeconds != null -> AuthCooldownNotice(authRetryAfterSeconds)
            error != null -> ErrorState(error)
        }
        PrimaryActionButton(
            label = authRetryAfterSeconds?.let { "Espera ${it}s" } ?: "Crear cuenta",
            loadingLabel = "Creando cuenta",
            onClick = { submit() },
            modifier = Modifier.fillMaxWidth(),
            enabled = !isLoading && authRetryAfterSeconds == null,
            isLoading = isLoading,
        )
        TextButton(onClick = onBackToLogin, enabled = !isLoading, modifier = Modifier.fillMaxWidth()) {
            Text("Ya tengo cuenta", textAlign = TextAlign.Center)
        }
    }
}
