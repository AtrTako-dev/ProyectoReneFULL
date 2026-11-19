package com.proyectorenefull.app.viewmodel

import androidx.lifecycle.ViewModel
import com.proyectorenefull.app.model.auth.AccountRole
import com.proyectorenefull.app.model.auth.AuthCredentials
import com.proyectorenefull.app.model.auth.AuthFailure
import com.proyectorenefull.app.model.auth.AuthFeedback
import com.proyectorenefull.app.model.auth.AuthRepository
import com.proyectorenefull.app.model.auth.LoginResult
import com.proyectorenefull.app.model.auth.RegistrationCredentials
import com.proyectorenefull.app.model.auth.RegistrationResult
import com.proyectorenefull.app.model.auth.SessionRestoreResult
import com.proyectorenefull.app.model.auth.toFeedback
import com.proyectorenefull.app.validation.AuthValidator
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class AuthUiState(
    val name: String = "",
    val email: String = "",
    val password: String = "",
    val nameError: String? = null,
    val emailError: String? = null,
    val passwordError: String? = null,
    val feedback: AuthFeedback? = null,
    val isSubmitting: Boolean = false,
    val isRestoringSession: Boolean = false,
    val authenticatedRole: AccountRole? = null
)

class AuthViewModel(private val repository: AuthRepository) : ViewModel() {
    private val _state = MutableStateFlow(AuthUiState())
    val state = _state.asStateFlow()

    fun updateName(value: String) {
        _state.update { it.copy(name = value, nameError = null, feedback = null) }
    }

    fun updateEmail(value: String) {
        _state.update { it.copy(email = value, emailError = null, feedback = null) }
    }

    fun updatePassword(value: String) {
        _state.update { it.copy(password = value, passwordError = null, feedback = null) }
    }

    fun clearPassword() {
        _state.update { it.copy(password = "", passwordError = null, feedback = null) }
    }

    fun showSessionExpired() {
        repository.logout()
        _state.update {
            it.copy(
                password = "",
                passwordError = null,
                authenticatedRole = null,
                isSubmitting = false,
                isRestoringSession = false,
                feedback = AuthFailure.SessionExpired.toFeedback()
            )
        }
    }

    fun restoreSession() {
        if (_state.value.isRestoringSession) return
        _state.update { it.copy(isRestoringSession = true, feedback = null) }
        repository.restoreSession { result ->
            when (result) {
                SessionRestoreResult.NoSession -> _state.update { it.copy(isRestoringSession = false) }
                is SessionRestoreResult.Authenticated -> onLoginSucceeded(result.role)
                is SessionRestoreResult.Failure -> {
                    _state.update {
                        it.copy(
                            isRestoringSession = false,
                            feedback = result.reason.toFeedback(),
                            authenticatedRole = null
                        )
                    }
                }
            }
        }
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
            isSubmitting = false
        )
        if (emailError != null || passwordError != null) return

        onLoginStarted()
        repository.login(AuthCredentials(current.email.trim(), current.password)) { result ->
            when (result) {
                is LoginResult.Success -> onLoginSucceeded(result.role)
                is LoginResult.Failure -> handleAuthFailure(
                    result.reason, result.nameError, result.emailError, result.passwordError
                )
            }
        }
    }

    fun submitRegistration() {
        val current = _state.value
        val nameError = AuthValidator.validateName(current.name)
        val emailError = AuthValidator.validateEmail(current.email)
        val passwordError = AuthValidator.validatePassword(current.password)
        _state.value = current.copy(
            nameError = nameError,
            emailError = emailError,
            passwordError = passwordError,
            feedback = null,
            isSubmitting = false,
            authenticatedRole = null
        )
        if (nameError != null || emailError != null || passwordError != null) return

        onRegistrationStarted()
        repository.register(
            RegistrationCredentials(current.name.trim(), current.email.trim(), current.password)
        ) { result ->
            when (result) {
                is RegistrationResult.Success -> onRegistrationSucceeded(result.role)
                is RegistrationResult.Failure -> handleAuthFailure(
                    result.reason, result.nameError, result.emailError, result.passwordError
                )
            }
        }
    }

    fun onLoginStarted() {
        _state.update {
            it.copy(isSubmitting = true, feedback = null, authenticatedRole = null)
        }
    }

    fun onLoginSucceeded(role: AccountRole) {
        _state.update {
            it.copy(
                password = "",
                passwordError = null,
                feedback = null,
                isSubmitting = false,
                isRestoringSession = false,
                authenticatedRole = role
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
                isRestoringSession = false,
                authenticatedRole = null
            )
        }
    }

    fun onRegistrationStarted() {
        _state.update { it.copy(isSubmitting = true, feedback = null) }
    }

    fun onRegistrationSucceeded(role: AccountRole) {
        _state.update {
            it.copy(
                password = "",
                passwordError = null,
                feedback = null,
                isSubmitting = false,
                authenticatedRole = role
            )
        }
    }

    fun onSessionExpired() {
        onLoginFailed(AuthFailure.SessionExpired)
    }

    fun logout() {
        repository.logout()
        _state.value = AuthUiState()
    }

    fun clearAuthenticationResult() {
        _state.update { it.copy(authenticatedRole = null, isSubmitting = false) }
    }

    private fun handleAuthFailure(
        reason: AuthFailure,
        nameError: String?,
        emailError: String?,
        passwordError: String?
    ) {
        if (nameError != null || emailError != null || passwordError != null) {
            _state.update {
                it.copy(
                    password = "",
                    nameError = nameError,
                    emailError = emailError,
                    passwordError = passwordError,
                    feedback = null,
                    isSubmitting = false,
                    authenticatedRole = null
                )
            }
        } else {
            onLoginFailed(reason)
        }
    }
}
