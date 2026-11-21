package com.morestock.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val MoreStockLightColors = lightColorScheme(
    primary = Color(0xFF0C6B54),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD2F1E7),
    onPrimaryContainer = Color(0xFF063B30),
    secondary = Color(0xFF48645C),
    background = Color(0xFFF5F7F4),
    surface = Color.White,
    surfaceVariant = Color(0xFFE8EEEA),
    error = Color(0xFFBA1A1A),
)

private val MoreStockDarkColors = darkColorScheme(
    primary = Color(0xFF8DD6BF),
    onPrimary = Color(0xFF00382B),
    primaryContainer = Color(0xFF00513F),
    onPrimaryContainer = Color(0xFFB2F0D8),
    secondary = Color(0xFFB2CCC2),
    background = Color(0xFF101512),
    surface = Color(0xFF171D19),
    surfaceVariant = Color(0xFF29332D),
)

@Composable
fun MoreStockTheme(
    darkTheme: Boolean = false,
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) MoreStockDarkColors else MoreStockLightColors,
        content = content,
    )
}
