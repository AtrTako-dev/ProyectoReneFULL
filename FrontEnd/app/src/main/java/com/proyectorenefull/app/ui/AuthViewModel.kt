package com.proyectorenefull.app.ui

import androidx.lifecycle.ViewModel
import com.proyectorenefull.app.domain.auth.AccountRole
import com.proyectorenefull.app.domain.auth.AuthCredentials
import com.proyectorenefull.app.domain.auth.AuthFailure
import com.proyectorenefull.app.domain.auth.AuthFeedback
import com.proyectorenefull.app.domain.auth.AuthRepository
import com.proyectorenefull.app.domain.auth.LoginResult
import com.proyectorenefull.app.domain.auth.RegistrationResult
import com.proyectorenefull.app.domain.auth.toFeedback
import com.proyectorenefull.app.validation.AuthValidator
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class AuthUiState(
    val email: String = "",
    val password: String = "",
    val emailError: String? = null,
    val passwordError: String? = null,
    val feedback: AuthFeedback? = null,
    val isSubmitting: Boolean = false,
    val authenticatedRole: AccountRole? = null,
    val isPreviewSession: Boolean = false
)

class AuthViewModel(
    private val repository: AuthRepository
) : ViewModel() {
    private val _state = MutableStateFlow(AuthUiState())
    val state = _state.asStateFlow()

    fun updateEmail(value: String) {
        _state.update { it.copy(email = value, emailError = null, feedback = null) }
    }

    fun updatePassword(value: String) {
        _state.update { it.copy(password = value, passwordError = null, feedback = null) }
    }

    fun clearPassword() {
        _state.update { it.copy(password = "", passwordError = null, feedback = null) }
    }

    fun submitLogin() {
        val current = _state.value
        val emailError = AuthValidator.validateEmail(current.email)
        val passwordError = AuthValidator.validatePassword(current.password)
        _state.value = current.copy(
            emailError = emailError,
            passwordError = passwordError,
            feedback = null,
            authenticatedRole = null,
            isPreviewSession = false,
            isSubmitting = false
        )
        if (emailError != null || passwordError != null) return

        onLoginStarted()
        repository.login(AuthCredentials(current.email.trim(), current.password)) { result ->
            when (result) {
                is LoginResult.Success -> onLoginSucceeded(result.role, result.isPreview)
                is LoginResult.Failure -> {
                    if (result.emailError != null || result.passwordError != null) {
                        onFieldValidationFailed(result.emailError, result.passwordError)
                    } else {
                        onLoginFailed(result.reason)
                    }
                }
            }
        }
    }

    fun submitRegistration() {
        val current = _state.value
        val emailError = AuthValidator.validateEmail(current.email)
        val passwordError = AuthValidator.validatePassword(current.password)
        _state.value = current.copy(
            emailError = emailError,
            passwordError = passwordError,
            feedback = null,
            isSubmitting = false,
            authenticatedRole = null,
            isPreviewSession = false
        )
        if (emailError != null || passwordError != null) return

        onRegistrationStarted()
        repository.register(AuthCredentials(current.email.trim(), current.password)) { result ->
            when (result) {
                is RegistrationResult.Success -> onRegistrationSucceeded(result.isPreview)
                is RegistrationResult.Failure -> {
                    if (result.emailError != null || result.passwordError != null) {
                        onFieldValidationFailed(result.emailError, result.passwordError)
                    } else {
                        onRegistrationFailed(result.reason)
                    }
                }
            }
        }
    }

    fun onLoginStarted() {
        _state.update {
            it.copy(
                isSubmitting = true,
                feedback = null,
                authenticatedRole = null,
                isPreviewSession = false
            )
        }
    }

    fun onLoginSucceeded(role: AccountRole, isPreview: Boolean) {
        _state.update {
            it.copy(
                password = "",
                passwordError = null,
                feedback = null,
                isSubmitting = false,
                authenticatedRole = role,
                isPreviewSession = isPreview
            )
        }
    }

    fun onLoginFailed(failure: AuthFailure) {
        _state.update {
            it.copy(
                password = "",
                passwordError = null,
                feedback = failure.toFeedback(),
                isSubmitting = false,
                authenticatedRole = null,
                isPreviewSession = false
            )
        }
    }

    fun onRegistrationStarted() {
        _state.update { it.copy(isSubmitting = true, feedback = null, isPreviewSession = false) }
    }

    fun onRegistrationFailed(failure: AuthFailure) {
        _state.update {
            it.copy(
                password = "",
                passwordError = null,
                feedback = failure.toFeedback(),
                isSubmitting = false,
                authenticatedRole = null,
                isPreviewSession = false
            )
        }
    }

    fun onRegistrationSucceeded(isPreview: Boolean) {
        _state.update {
            it.copy(
                password = "",
                passwordError = null,
                feedback = AuthFeedback(
                    if (isPreview) "Registro simulado; no se creó una cuenta real."
                    else "Cuenta creada. Inicia sesión para continuar.",
                    isError = false
                ),
                isSubmitting = false,
                authenticatedRole = null,
                isPreviewSession = false
            )
        }
    }

    fun onFieldValidationFailed(emailError: String?, passwordError: String?) {
        _state.update {
            it.copy(
                password = "",
                emailError = emailError,
                passwordError = passwordError,
                feedback = null,
                isSubmitting = false,
                authenticatedRole = null,
                isPreviewSession = false
            )
        }
    }

    fun clearAuthenticationResult() {
        _state.update { it.copy(authenticatedRole = null, isSubmitting = false) }
    }

    fun clearPreviewState() {
        _state.update { it.copy(authenticatedRole = null, isPreviewSession = false, isSubmitting = false) }
    }
}
