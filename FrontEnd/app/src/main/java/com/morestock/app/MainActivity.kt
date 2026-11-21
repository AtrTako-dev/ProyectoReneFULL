package com.morestock.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.ViewModelProvider
import com.morestock.app.data.MoreStockApi
import com.morestock.app.data.MoreStockRepository
import com.morestock.app.ui.MoreStockApp
import com.morestock.app.ui.theme.MoreStockTheme
import com.morestock.app.ui.viewmodel.MoreStockViewModel
import com.morestock.app.ui.viewmodel.MoreStockViewModelFactory

class MainActivity : ComponentActivity() {
    private lateinit var viewModel: MoreStockViewModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val repository = MoreStockRepository(MoreStockApi(BuildConfig.API_BASE_URL))
        viewModel = ViewModelProvider(this, MoreStockViewModelFactory(repository))[MoreStockViewModel::class.java]

        setContent {
            MoreStockTheme {
                MoreStockApp(viewModel)
            }
        }
    }
}
