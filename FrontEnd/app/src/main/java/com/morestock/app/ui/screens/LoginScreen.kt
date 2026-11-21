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
import com.morestock.app.ui.validation.AuthFormValidation
import com.morestock.app.ui.view.components.ErrorState
import com.morestock.app.ui.view.components.PrimaryActionButton
import com.morestock.app.ui.view.components.SecondaryActionButton
import com.morestock.app.ui.view.components.ValidatedTextField

@Composable
fun LoginScreen(
    isLoading: Boolean,
    error: String?,
    canRetry: Boolean,
    authRetryAfterSeconds: Long?,
    onLogin: (String, String) -> Unit,
    onRegister: (String, String, String) -> Unit,
    onClearError: () -> Unit,
) {
    var registrationMode by rememberSaveable { mutableStateOf(false) }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }

    if (registrationMode) {
        RegistrationScreen(
            isLoading = isLoading,
            error = error,
            authRetryAfterSeconds = authRetryAfterSeconds,
            onRegister = onRegister,
            onBackToLogin = {
                registrationMode = false
                onClearError()
            },
            onClearError = onClearError,
        )
    } else {
        LoginForm(
            email = email,
            onEmailChange = { email = it },
            password = password,
            onPasswordChange = { password = it },
            isLoading = isLoading,
            error = error,
            canRetry = canRetry,
            authRetryAfterSeconds = authRetryAfterSeconds,
            onLogin = onLogin,
            onRegister = {
                registrationMode = true
                onClearError()
            },
            onClearError = onClearError,
        )
    }
}

@Composable
private fun LoginForm(
    email: String,
    onEmailChange: (String) -> Unit,
    password: String,
    onPasswordChange: (String) -> Unit,
    isLoading: Boolean,
    error: String?,
    canRetry: Boolean,
    authRetryAfterSeconds: Long?,
    onLogin: (String, String) -> Unit,
    onRegister: () -> Unit,
    onClearError: () -> Unit,
) {
    var emailTouched by rememberSaveable { mutableStateOf(false) }
    var passwordTouched by rememberSaveable { mutableStateOf(false) }
    var submitted by rememberSaveable { mutableStateOf(false) }
    var passwordVisible by rememberSaveable { mutableStateOf(false) }
    val emailFocus = remember { FocusRequester() }
    val passwordFocus = remember { FocusRequester() }
    val emailError = AuthFormValidation.emailError(email).takeIf { emailTouched || submitted }
    val passwordError = AuthFormValidation.loginPasswordError(password).takeIf { passwordTouched || submitted }
    val isValid = AuthFormValidation.emailError(email) == null && AuthFormValidation.loginPasswordError(password) == null

    fun submit() {
        submitted = true
        if (isValid && !isLoading) onLogin(email.trim(), password)
    }

    AuthScreenLayout(
        heading = "Iniciar sesión",
        description = "Consulta el inventario de tu negocio.",
    ) {
        ValidatedTextField(
            value = email,
            onValueChange = {
                onEmailChange(it)
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
                onPasswordChange(it)
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
        when {
            authRetryAfterSeconds != null -> AuthCooldownNotice(authRetryAfterSeconds)
            error != null -> ErrorState(error)
        }
        PrimaryActionButton(
            label = when {
                authRetryAfterSeconds != null -> "Espera ${authRetryAfterSeconds}s"
                canRetry && error != null -> "Reintentar"
                else -> "Entrar"
            },
            loadingLabel = "Iniciando sesión",
            onClick = { submit() },
            modifier = Modifier.fillMaxWidth(),
            enabled = authRetryAfterSeconds == null,
            isLoading = isLoading,
        )
        SecondaryActionButton(
            label = "Crear cuenta",
            onClick = onRegister,
            modifier = Modifier.fillMaxWidth(),
            enabled = !isLoading,
        )
    }
}
