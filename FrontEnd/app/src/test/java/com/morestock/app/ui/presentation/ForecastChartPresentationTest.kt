package com.morestock.app.ui.presentation

import com.morestock.app.data.ForecastPoint
import org.junit.Assert.assertEquals
import org.junit.Test

class ForecastChartPresentationTest {
    @Test
    fun keepsHistoryAndForecastInSeparateSeriesAndApiOrder() {
        val history = listOf(ForecastPoint("2026-11-01", 4.0), ForecastPoint("2026-11-08", 6.0))
        val forecast = listOf(ForecastPoint("2026-11-15", 7.5))

        val samples = ForecastChartPresentation.combine(history, forecast)

        assertEquals(
            listOf(
                ForecastChartSample("2026-11-01", 4.0, ForecastSeries.HISTORY),
                ForecastChartSample("2026-11-08", 6.0, ForecastSeries.HISTORY),
                ForecastChartSample("2026-11-15", 7.5, ForecastSeries.FORECAST),
            ),
            samples,
        )
    }

    @Test
    fun returnsNoSamplesWhenApiHasNoChartData() {
        assertEquals(emptyList<ForecastChartSample>(), ForecastChartPresentation.combine(emptyList(), emptyList()))
    }
}
