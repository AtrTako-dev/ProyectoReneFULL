package com.proyectorenefull.app.data

import android.content.Context
import com.proyectorenefull.app.BuildConfig
import com.proyectorenefull.app.data.admin.ApiAdminRepository
import com.proyectorenefull.app.data.auth.ApiAuthRepository
import com.proyectorenefull.app.data.client.ApiClientRepository
import com.proyectorenefull.app.data.remote.ClienteApi
import com.proyectorenefull.app.data.session.SessionStore

class AppContainer(context: Context) {
    private val sessionStore = SessionStore(context.applicationContext)
    private val api = ClienteApi(BuildConfig.API_BASE_URL, sessionStore)

    val authRepository = ApiAuthRepository(api, sessionStore)
    val clientRepository = ApiClientRepository(api)
    val adminRepository = ApiAdminRepository(api)
}
