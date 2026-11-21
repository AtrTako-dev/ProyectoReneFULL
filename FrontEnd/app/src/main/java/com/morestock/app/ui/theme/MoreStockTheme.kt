package com.morestock.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.shape.RoundedCornerShape

data class RecommendationStateColors(
    val background: Color,
    val foreground: Color,
    val icon: Color,
)

data class MoreStockStateColors(
    val buy: RecommendationStateColors,
    val maintain: RecommendationStateColors,
    val noBuy: RecommendationStateColors,
)

internal val MoreStockLightStateColors = MoreStockStateColors(
    buy = RecommendationStateColors(
        background = Color(0xFFD2F1E7),
        foreground = Color(0xFF063B30),
        icon = Color(0xFF0C6B54),
    ),
    maintain = RecommendationStateColors(
        background = Color(0xFFFFF1C2),
        foreground = Color(0xFF684500),
        icon = Color(0xFF815A00),
    ),
    noBuy = RecommendationStateColors(
        background = Color(0xFFFCE8E6),
        foreground = Color(0xFF8D1D1D),
        icon = Color(0xFFBA1A1A),
    ),
)

internal val MoreStockDarkStateColors = MoreStockStateColors(
    buy = RecommendationStateColors(
        background = Color(0xFF164E3A),
        foreground = Color(0xFFB7F7D5),
        icon = Color(0xFF8DD6BF),
    ),
    maintain = RecommendationStateColors(
        background = Color(0xFF57410B),
        foreground = Color(0xFFFFE49A),
        icon = Color(0xFFFFD267),
    ),
    noBuy = RecommendationStateColors(
        background = Color(0xFF5A2525),
        foreground = Color(0xFFFFC5C1),
        icon = Color(0xFFFFB4AB),
    ),
)

val LocalMoreStockStateColors = staticCompositionLocalOf { MoreStockLightStateColors }

internal val MoreStockLightColorScheme = lightColorScheme(
    primary = Color(0xFF0C6B54),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD2F1E7),
    onPrimaryContainer = Color(0xFF063B30),
    secondary = Color(0xFF48645C),
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFE1ECE6),
    onSecondaryContainer = Color(0xFF1B352D),
    background = Color(0xFFF5F7F4),
    onBackground = Color(0xFF17221C),
    surface = Color.White,
    onSurface = Color(0xFF17221C),
    surfaceVariant = Color(0xFFE8EEEA),
    onSurfaceVariant = Color(0xFF364740),
    outline = Color(0xFF66736C),
    error = Color(0xFFBA1A1A),
    onError = Color.White,
    errorContainer = Color(0xFFFCE8E6),
    onErrorContainer = Color(0xFF8D1D1D),
)

internal val MoreStockDarkColorScheme = darkColorScheme(
    primary = Color(0xFF8DD6BF),
    onPrimary = Color(0xFF00382B),
    primaryContainer = Color(0xFF00513F),
    onPrimaryContainer = Color(0xFFB2F0D8),
    secondary = Color(0xFFB2CCC2),
    onSecondary = Color(0xFF20332C),
    secondaryContainer = Color(0xFF354A41),
    onSecondaryContainer = Color(0xFFD8E9E0),
    background = Color(0xFF101512),
    onBackground = Color(0xFFE7EFEA),
    surface = Color(0xFF171D19),
    onSurface = Color(0xFFE7EFEA),
    surfaceVariant = Color(0xFF29332D),
    onSurfaceVariant = Color(0xFFC0CEC6),
    outline = Color(0xFF8A9990),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6),
)

internal val MoreStockTypography = Typography(
    displayLarge = textStyle(32, 40, FontWeight.Bold),
    displayMedium = textStyle(28, 36, FontWeight.Bold),
    displaySmall = textStyle(24, 32, FontWeight.SemiBold),
    headlineLarge = textStyle(28, 36, FontWeight.Bold),
    headlineMedium = textStyle(24, 32, FontWeight.Bold),
    headlineSmall = textStyle(20, 28, FontWeight.SemiBold),
    titleLarge = textStyle(20, 28, FontWeight.SemiBold),
    titleMedium = textStyle(16, 24, FontWeight.Medium),
    titleSmall = textStyle(14, 20, FontWeight.Medium),
    bodyLarge = textStyle(16, 24),
    bodyMedium = textStyle(14, 20),
    bodySmall = textStyle(12, 18),
    labelLarge = textStyle(14, 20, FontWeight.Medium),
    labelMedium = textStyle(12, 16, FontWeight.Medium),
    labelSmall = textStyle(11, 16, FontWeight.Medium),
)

internal val MoreStockShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(14.dp),
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(28.dp),
)

object MoreStockSpacing {
    val xSmall = 4.dp
    val small = 8.dp
    val medium = 12.dp
    val large = 16.dp
    val xLarge = 24.dp
    val xxLarge = 32.dp
}

@Composable
fun MoreStockTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    CompositionLocalProvider(
        LocalMoreStockStateColors provides if (darkTheme) MoreStockDarkStateColors else MoreStockLightStateColors,
    ) {
        MaterialTheme(
            colorScheme = if (darkTheme) MoreStockDarkColorScheme else MoreStockLightColorScheme,
            typography = MoreStockTypography,
            shapes = MoreStockShapes,
            content = content,
        )
    }
}

private fun textStyle(size: Int, lineHeight: Int, weight: FontWeight = FontWeight.Normal) = TextStyle(
    fontFamily = FontFamily.Default,
    fontSize = size.sp,
    lineHeight = lineHeight.sp,
    fontWeight = weight,
)
