package com.morestock.app.ui.presentation

import com.morestock.app.data.ForecastPoint

enum class ForecastSeries {
    HISTORY,
    FORECAST,
}

data class ForecastChartSample(
    val date: String,
    val demand: Double,
    val series: ForecastSeries,
)

object ForecastChartPresentation {
    fun combine(
        history: List<ForecastPoint>,
        forecast: List<ForecastPoint>,
    ): List<ForecastChartSample> = buildList(history.size + forecast.size) {
        history.forEach { add(ForecastChartSample(it.date, it.demand, ForecastSeries.HISTORY)) }
        forecast.forEach { add(ForecastChartSample(it.date, it.demand, ForecastSeries.FORECAST)) }
    }
}
