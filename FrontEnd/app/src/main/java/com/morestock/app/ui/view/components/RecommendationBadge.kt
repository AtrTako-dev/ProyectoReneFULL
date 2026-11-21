package com.morestock.app.ui.view.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp
import com.morestock.app.ui.theme.LocalMoreStockStateColors
import com.morestock.app.ui.theme.MoreStockSpacing
import com.morestock.app.ui.theme.RecommendationStateColors

enum class RecommendationState {
    BUY,
    MAINTAIN,
    DO_NOT_BUY,
    UNKNOWN,
}

@Composable
fun RecommendationBadge(
    label: String,
    state: RecommendationState,
    modifier: Modifier = Modifier,
) {
    val palette = LocalMoreStockStateColors.current
    val colors = when (state) {
        RecommendationState.BUY -> palette.buy
        RecommendationState.MAINTAIN -> palette.maintain
        RecommendationState.DO_NOT_BUY -> palette.noBuy
        RecommendationState.UNKNOWN -> RecommendationStateColors(
            background = MaterialTheme.colorScheme.surfaceVariant,
            foreground = MaterialTheme.colorScheme.onSurfaceVariant,
            icon = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }

    Surface(
        modifier = modifier,
        shape = CircleShape,
        color = colors.background,
        contentColor = colors.foreground,
    ) {
        Row(
            modifier = Modifier
                .semantics(mergeDescendants = true) {}
                .padding(horizontal = MoreStockSpacing.medium, vertical = MoreStockSpacing.small),
            horizontalArrangement = Arrangement.spacedBy(MoreStockSpacing.small),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            RecommendationGlyph(
                state = state,
                color = colors.icon,
                modifier = Modifier.size(18.dp).clearAndSetSemantics {},
            )
            Text(label, style = MaterialTheme.typography.labelLarge, color = colors.foreground)
        }
    }
}

@Composable
private fun RecommendationGlyph(
    state: RecommendationState,
    color: Color,
    modifier: Modifier = Modifier,
) {
    Canvas(modifier = modifier) {
        val strokeWidth = size.minDimension * 0.11f
        when (state) {
            RecommendationState.BUY -> {
                val check = Path().apply {
                    moveTo(size.width * 0.18f, size.height * 0.52f)
                    lineTo(size.width * 0.42f, size.height * 0.75f)
                    lineTo(size.width * 0.84f, size.height * 0.25f)
                }
                drawPath(check, color, style = Stroke(strokeWidth, cap = StrokeCap.Round))
            }
            RecommendationState.MAINTAIN -> {
                drawCircle(color, style = Stroke(strokeWidth))
                drawLine(
                    color = color,
                    start = Offset(size.width * 0.25f, size.height * 0.5f),
                    end = Offset(size.width * 0.75f, size.height * 0.5f),
                    strokeWidth = strokeWidth,
                    cap = StrokeCap.Round,
                )
            }
            RecommendationState.DO_NOT_BUY -> {
                drawLine(
                    color = color,
                    start = Offset(size.width * 0.23f, size.height * 0.23f),
                    end = Offset(size.width * 0.77f, size.height * 0.77f),
                    strokeWidth = strokeWidth,
                    cap = StrokeCap.Round,
                )
                drawLine(
                    color = color,
                    start = Offset(size.width * 0.77f, size.height * 0.23f),
                    end = Offset(size.width * 0.23f, size.height * 0.77f),
                    strokeWidth = strokeWidth,
                    cap = StrokeCap.Round,
                )
            }
            RecommendationState.UNKNOWN -> drawCircle(color, radius = size.minDimension * 0.18f)
        }
    }
}
