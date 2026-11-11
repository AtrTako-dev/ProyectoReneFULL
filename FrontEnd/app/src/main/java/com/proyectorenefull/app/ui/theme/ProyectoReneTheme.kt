package com.proyectorenefull.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Color(0xFF0F766E),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFCCFBF1),
    onPrimaryContainer = Color(0xFF073B38),
    secondary = Color(0xFF245C78),
    onSecondary = Color.White,
    background = Color(0xFFF5F8FA),
    onBackground = Color(0xFF17212B),
    surface = Color.White,
    onSurface = Color(0xFF17212B),
    surfaceVariant = Color(0xFFE8EEF2),
    onSurfaceVariant = Color(0xFF425466),
    error = Color(0xFFB42318),
    onError = Color.White
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF5EEAD4),
    onPrimary = Color(0xFF003731),
    secondary = Color(0xFF9ACBE2),
    background = Color(0xFF10191D),
    onBackground = Color(0xFFE6EEF2),
    surface = Color(0xFF172227),
    onSurface = Color(0xFFE6EEF2),
    surfaceVariant = Color(0xFF26363D),
    onSurfaceVariant = Color(0xFFC0CDD3),
    error = Color(0xFFFDA29B),
    onError = Color(0xFF410E0B)
)

@Composable
fun ProyectoReneTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        content = content
    )
}
