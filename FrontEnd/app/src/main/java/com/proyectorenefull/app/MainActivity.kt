package com.proyectorenefull.app

import android.content.res.Configuration
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.proyectorenefull.app.view.ProyectoReneApp
import com.proyectorenefull.app.view.theme.ProyectoReneTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val modoNoche = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
        val temaOscuro = modoNoche == Configuration.UI_MODE_NIGHT_YES
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = !temaOscuro
            isAppearanceLightNavigationBars = !temaOscuro
        }
        setContent {
            ProyectoReneTheme {
                ProyectoReneApp()
            }
        }
    }
}
