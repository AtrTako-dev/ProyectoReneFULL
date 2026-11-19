package com.proyectorenefull.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.proyectorenefull.app.view.ProyectoReneApp
import com.proyectorenefull.app.view.theme.ProyectoReneTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ProyectoReneTheme {
                ProyectoReneApp()
            }
        }
    }
}
