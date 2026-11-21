package com.morestock.app.ui.theme

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertTrue
import org.junit.Test

class MoreStockThemeTest {
    @Test
    fun semanticTextColorsMeetWcagAaInLightAndDarkThemes() {
        val schemes = listOf(MoreStockLightColorScheme, MoreStockDarkColorScheme)
        schemes.forEach { scheme ->
            listOf(
                scheme.primary to scheme.onPrimary,
                scheme.primaryContainer to scheme.onPrimaryContainer,
                scheme.background to scheme.onBackground,
                scheme.background to scheme.secondary,
                scheme.surface to scheme.onSurface,
                scheme.surfaceVariant to scheme.onSurfaceVariant,
                scheme.error to scheme.onError,
                scheme.errorContainer to scheme.onErrorContainer,
            ).forEach { (background, foreground) ->
                assertTrue(contrastRatio(foreground, background) >= 4.5)
            }
        }
    }

    @Test
    fun recommendationStateTextMeetsWcagAaInLightAndDarkThemes() {
        val palettes = listOf(
            "claro" to MoreStockLightStateColors,
            "oscuro" to MoreStockDarkStateColors,
        )

        palettes.forEach { (theme, palette) ->
            listOf(
                "COMPRAR" to palette.buy,
                "MANTENER" to palette.maintain,
                "NO_COMPRAR" to palette.noBuy,
            ).forEach { (state, colors) ->
                val ratio = contrastRatio(colors.foreground, colors.background)
                assertTrue(
                    "$state en tema $theme debe alcanzar contraste AA; obtuvo $ratio:1",
                    ratio >= 4.5,
                )
            }
        }
    }

    @Test
    fun recommendationStateIconsMeetNonTextContrastInLightAndDarkThemes() {
        val palettes = listOf(MoreStockLightStateColors, MoreStockDarkStateColors)
        palettes.forEach { palette ->
            listOf(palette.buy, palette.maintain, palette.noBuy).forEach { colors ->
                assertTrue(contrastRatio(colors.icon, colors.background) >= 3.0)
            }
        }
    }

    private fun contrastRatio(first: Color, second: Color): Double {
        val lighter = maxOf(relativeLuminance(first), relativeLuminance(second))
        val darker = minOf(relativeLuminance(first), relativeLuminance(second))
        return (lighter + 0.05) / (darker + 0.05)
    }

    private fun relativeLuminance(color: Color): Double {
        fun linearize(channel: Float): Double {
            val value = channel.toDouble()
            return if (value <= 0.04045) value / 12.92 else Math.pow((value + 0.055) / 1.055, 2.4)
        }

        return 0.2126 * linearize(color.red) +
            0.7152 * linearize(color.green) +
            0.0722 * linearize(color.blue)
    }
}
