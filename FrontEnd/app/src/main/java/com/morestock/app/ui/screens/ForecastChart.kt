package com.morestock.app.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.morestock.app.data.ForecastPoint
import com.morestock.app.ui.presentation.ForecastChartPresentation
import com.morestock.app.ui.presentation.ForecastChartSample
import com.morestock.app.ui.presentation.ForecastSeries
import kotlin.math.roundToInt

@Composable
internal fun ForecastChart(
    history: List<ForecastPoint>,
    forecast: List<ForecastPoint>,
    unit: String,
    modifier: Modifier = Modifier,
) {
    val samples = remember(history, forecast) { ForecastChartPresentation.combine(history, forecast) }
    var selectedIndex by remember(samples) { mutableIntStateOf(samples.lastIndex) }
    val selected = samples.getOrNull(selectedIndex)
    val primary = MaterialTheme.colorScheme.primary
    val forecastColor = MaterialTheme.colorScheme.tertiary
    val grid = MaterialTheme.colorScheme.outlineVariant
    val labelColor = MaterialTheme.colorScheme.onSurfaceVariant
    val finiteValues = samples.map(ForecastChartSample::demand).filter(Double::isFinite)
    val minValue = minOf(0.0, finiteValues.minOrNull() ?: 0.0)
    val rawMaxValue = maxOf(0.0, finiteValues.maxOrNull() ?: 0.0)
    val maxValue = if (rawMaxValue > minValue) rawMaxValue else minValue + 1.0

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
            ChartLegend(color = primary, label = "Histórico", dashed = false)
            ChartLegend(color = forecastColor, label = "Pronóstico (estimado)", dashed = true)
        }
        Text(
            "Cantidad ($unit) · escala ${formatAmount(minValue)}–${formatAmount(maxValue)}",
            style = MaterialTheme.typography.labelSmall,
            color = labelColor,
        )
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(190.dp)
                .pointerInput(samples) {
                    detectTapGestures { offset ->
                        if (samples.isNotEmpty()) {
                            val left = 12.dp.toPx()
                            val right = size.width - 12.dp.toPx()
                            val x = offset.x.coerceIn(left, right)
                            val fraction = ((x - left) / (right - left).coerceAtLeast(1f)).coerceIn(0f, 1f)
                            selectedIndex = (fraction * samples.lastIndex).roundToInt()
                        }
                    }
                }
                .semantics {
                    contentDescription = "Gráfica de cantidad histórica y pronosticada. El trazo sólido representa el historial; el discontinuo, una estimación."
                    stateDescription = selected?.let {
                        "${it.series.label()} del ${it.date}: ${formatAmount(it.demand)} $unit"
                    }.orEmpty()
                    customActions = if (samples.isEmpty()) emptyList() else listOf(
                        CustomAccessibilityAction("Punto anterior") {
                            if (selectedIndex > 0) {
                                selectedIndex -= 1
                                true
                            } else {
                                false
                            }
                        },
                        CustomAccessibilityAction("Punto siguiente") {
                            if (selectedIndex < samples.lastIndex) {
                                selectedIndex += 1
                                true
                            } else {
                                false
                            }
                        },
                    )
                },
        ) {
            if (samples.isEmpty()) return@Canvas
            val left = 12.dp.toPx()
            val right = size.width - 12.dp.toPx()
            val top = 10.dp.toPx()
            val bottom = size.height - 10.dp.toPx()
            val plotHeight = bottom - top
            val xStep = (right - left) / samples.lastIndex.coerceAtLeast(1)
            val valueRange = maxValue - minValue
            val points = samples.mapIndexed { index, sample ->
                val x = if (samples.size == 1) (left + right) / 2f else left + xStep * index
                val value = sample.demand.takeIf(Double::isFinite) ?: minValue
                val y = bottom - (((value - minValue) / valueRange).toFloat().coerceIn(0f, 1f) * plotHeight)
                Offset(x, y)
            }

            for (line in 0..3) {
                val y = top + plotHeight * line / 3f
                drawLine(grid, Offset(left, y), Offset(right, y), strokeWidth = 1.dp.toPx())
            }
            drawLine(grid, Offset(left, top), Offset(left, bottom), strokeWidth = 1.dp.toPx())
            drawLine(grid, Offset(left, bottom), Offset(right, bottom), strokeWidth = 1.dp.toPx())

            val historyCount = samples.count { it.series == ForecastSeries.HISTORY }
            drawSeries(points.take(historyCount), primary)
            val forecastPoints = buildList {
                if (historyCount > 0) add(points[historyCount - 1])
                addAll(points.drop(historyCount))
            }
            drawSeries(forecastPoints, forecastColor, dashed = true)

            points.forEachIndexed { index, point ->
                val color = if (samples[index].series == ForecastSeries.HISTORY) primary else forecastColor
                drawCircle(color, radius = if (index == selectedIndex) 6.dp.toPx() else 3.5.dp.toPx(), center = point)
            }
            points.getOrNull(selectedIndex)?.let { point ->
                drawLine(grid, Offset(point.x, top), Offset(point.x, bottom), strokeWidth = 1.dp.toPx())
                val color = if (samples[selectedIndex].series == ForecastSeries.HISTORY) primary else forecastColor
                drawCircle(color, radius = 7.dp.toPx(), center = point, style = Stroke(width = 2.dp.toPx()))
            }
        }
        if (samples.size == 1) {
            Text(samples.single().date, style = MaterialTheme.typography.labelSmall, color = labelColor)
        } else {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(samples.first().date, style = MaterialTheme.typography.labelSmall, color = labelColor)
                Text(samples.last().date, style = MaterialTheme.typography.labelSmall, color = labelColor)
            }
        }
        selected?.let {
            Text(
                "${it.series.label()} · ${it.date}: ${formatAmount(it.demand)} $unit",
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.SemiBold,
                color = labelColor,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            )
        }
        Text(
            "Toca un punto para ver su valor. El pronóstico es una estimación, no una venta confirmada.",
            style = MaterialTheme.typography.labelSmall,
            color = labelColor,
        )
    }
}

@Composable
private fun ChartLegend(color: androidx.compose.ui.graphics.Color, label: String, dashed: Boolean) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Canvas(Modifier.width(22.dp).height(14.dp)) {
            val y = size.height / 2f
            if (dashed) {
                val effect = PathEffect.dashPathEffect(floatArrayOf(5.dp.toPx(), 3.dp.toPx()))
                drawLine(color, Offset(0f, y), Offset(size.width, y), strokeWidth = 2.dp.toPx(), pathEffect = effect)
            } else {
                drawLine(color, Offset(0f, y), Offset(size.width, y), strokeWidth = 2.dp.toPx(), cap = StrokeCap.Round)
            }
        }
        Text(label, style = MaterialTheme.typography.labelSmall)
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawSeries(
    points: List<Offset>,
    color: androidx.compose.ui.graphics.Color,
    dashed: Boolean = false,
) {
    if (points.size < 2) return
    val path = Path().apply {
        moveTo(points.first().x, points.first().y)
        points.drop(1).forEach { lineTo(it.x, it.y) }
    }
    val pathEffect = if (dashed) PathEffect.dashPathEffect(floatArrayOf(8.dp.toPx(), 5.dp.toPx())) else null
    drawPath(path, color, style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round, pathEffect = pathEffect))
}

private fun ForecastSeries.label(): String = when (this) {
    ForecastSeries.HISTORY -> "Histórico"
    ForecastSeries.FORECAST -> "Pronóstico estimado"
}

private fun formatAmount(value: Double): String =
    if (value.isFinite() && value % 1.0 == 0.0) value.toLong().toString() else if (value.isFinite()) "%.2f".format(value) else "sin dato"
