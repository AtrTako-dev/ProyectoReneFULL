package com.proyectorenefull.app.data.session

import android.content.Context
import com.proyectorenefull.app.model.auth.AccountRole

private fun AccountRole.toServerValue(): String = when (this) {
    AccountRole.Client -> "cliente"
    AccountRole.Administrator -> "administrador"
}

private fun accountRoleFromServer(value: String?): AccountRole? = when (value) {
    "cliente" -> AccountRole.Client
    "administrador" -> AccountRole.Administrator
    else -> null
}

sealed interface StoredSession {
    data object Missing : StoredSession
    data object Expired : StoredSession
    data class Active(val token: String, val role: AccountRole) : StoredSession
}

class SessionStore(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences(
        PREFERENCES_NAME,
        Context.MODE_PRIVATE
    )

    fun save(token: String, role: AccountRole) {
        preferences.edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_ROLE, role.toServerValue())
            .putLong(KEY_EXPIRES_AT, System.currentTimeMillis() + SESSION_DURATION_MILLIS)
            .apply()
    }

    fun restore(): StoredSession {
        val token = preferences.getString(KEY_TOKEN, null) ?: return StoredSession.Missing
        val expiresAt = preferences.getLong(KEY_EXPIRES_AT, 0L)
        if (expiresAt <= System.currentTimeMillis()) {
            clear()
            return StoredSession.Expired
        }
        val role = accountRoleFromServer(preferences.getString(KEY_ROLE, null))
        if (role == null) {
            clear()
            return StoredSession.Missing
        }
        return StoredSession.Active(token, role)
    }

    fun token(): String? = when (val session = restore()) {
        is StoredSession.Active -> session.token
        StoredSession.Expired, StoredSession.Missing -> null
    }

    fun updateRole(role: AccountRole) {
        preferences.edit().putString(KEY_ROLE, role.toServerValue()).apply()
    }

    fun clear() {
        preferences.edit().clear().apply()
    }

    companion object {
        private const val PREFERENCES_NAME = "proyecto_renefull_session"
        private const val KEY_TOKEN = "token"
        private const val KEY_ROLE = "rol"
        private const val KEY_EXPIRES_AT = "expira_en"
        private const val SESSION_DURATION_MILLIS = 8 * 60 * 60 * 1000L
    }
}
