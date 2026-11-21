package com.morestock.app.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import com.morestock.app.data.Business
import com.morestock.app.data.InventoryItem
import com.morestock.app.data.Product
import com.morestock.app.data.Recommendation
import com.morestock.app.ui.presentation.ProductListPresentation
import com.morestock.app.ui.presentation.ProductListQuery
import com.morestock.app.ui.presentation.ProductSort
import com.morestock.app.ui.presentation.RecommendationFilter
import com.morestock.app.ui.theme.MoreStockSpacing
import com.morestock.app.ui.view.components.BusinessHeader
import com.morestock.app.ui.view.components.EmptyState
import com.morestock.app.ui.view.components.ErrorState
import com.morestock.app.ui.view.components.LoadingState
import com.morestock.app.ui.view.components.MetricCard
import com.morestock.app.ui.view.components.ProductCard
import com.morestock.app.ui.view.components.ProductRecommendation
import com.morestock.app.ui.view.components.RecommendationBadge
import com.morestock.app.ui.view.components.RecommendationState
import com.morestock.app.ui.view.components.SyntheticDataBanner
import com.morestock.app.ui.viewmodel.BusinessTab
import java.util.Locale

@Composable
fun BusinessScreen(
    business: Business,
    products: List<Product>,
    inventory: List<InventoryItem>,
    recommendations: List<Recommendation>,
    selectedTab: BusinessTab,
    isLoading: Boolean,
    error: String?,
    canRetry: Boolean,
    onSelectTab: (BusinessTab) -> Unit,
    onSelectProduct: (String) -> Unit,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
) {
    var search by rememberSaveable { mutableStateOf("") }
    var selectedCategory by rememberSaveable { mutableStateOf("") }
    var selectedRecommendationName by rememberSaveable { mutableStateOf(RecommendationFilter.ALL.name) }
    var selectedSortName by rememberSaveable { mutableStateOf(ProductSort.NAME_ASC.name) }
    val selectedRecommendation = RecommendationFilter.valueOf(selectedRecommendationName)
    val selectedSort = ProductSort.valueOf(selectedSortName)
    val categories = remember(products) { ProductListPresentation.categories(products) }
    LaunchedEffect(categories) {
        if (selectedCategory.isNotBlank() && categories.none { it.equals(selectedCategory, ignoreCase = true) }) {
            selectedCategory = ""
        }
    }
    val filteredProducts by remember(products, inventory, recommendations, search, selectedCategory, selectedRecommendation, selectedSort) {
        derivedStateOf {
            ProductListPresentation.filterAndSort(
                products = products,
                recommendations = recommendations,
                query = ProductListQuery(search, selectedCategory.ifBlank { null }, selectedRecommendation, selectedSort),
            )
        }
    }

    Scaffold(
        topBar = {
            BusinessHeader(
                businessName = business.name,
                roleLabel = business.roleLabel(),
                onBack = onBack,
                onRefresh = onRefresh,
                isLoading = isLoading,
            )
        },
        bottomBar = {
            NavigationBar {
                BusinessTab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = selectedTab == tab,
                        onClick = { onSelectTab(tab) },
                        icon = { BusinessTabGlyph(tab, selectedTab == tab) },
                        label = { Text(tab.label) },
                    )
                }
            }
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).imePadding(),
            contentPadding = PaddingValues(
                horizontal = MoreStockSpacing.large,
                vertical = MoreStockSpacing.medium,
            ),
            verticalArrangement = Arrangement.spacedBy(MoreStockSpacing.medium),
        ) {
            when {
                error != null -> item {
                    ErrorState(error, onRetry = if (canRetry) onRefresh else null)
                }
                isLoading -> item { LoadingState("Cargando información del negocio…") }
                else -> when (selectedTab) {
                    BusinessTab.SUMMARY -> summaryContent(
                        business = business,
                        products = products,
                        inventory = inventory,
                        recommendations = recommendations,
                        onSelectProduct = onSelectProduct,
                        onSelectTab = onSelectTab,
                    )
                    BusinessTab.CATALOG -> catalogContent(
                        products = filteredProducts,
                        allProducts = products,
                        inventory = inventory,
                        recommendations = recommendations,
                        categories = categories,
                        search = search,
                        onSearchChange = { search = it },
                        selectedCategory = selectedCategory,
                        onCategorySelected = { selectedCategory = it },
                        selectedRecommendation = selectedRecommendation,
                        onRecommendationSelected = { selectedRecommendationName = it.name },
                        selectedSort = selectedSort,
                        onSortSelected = { selectedSortName = it.name },
                        onResetFilters = {
                            search = ""
                            selectedCategory = ""
                            selectedRecommendationName = RecommendationFilter.ALL.name
                            selectedSortName = ProductSort.NAME_ASC.name
                        },
                        onSelectProduct = onSelectProduct,
                    )
                    BusinessTab.INVENTORY -> inventoryContent(inventory, products, onSelectProduct)
                    BusinessTab.RECOMMENDATIONS -> recommendationContent(recommendations, onSelectProduct)
                }
            }
        }
    }
}

private fun LazyListScope.summaryContent(
    business: Business,
    products: List<Product>,
    inventory: List<InventoryItem>,
    recommendations: List<Recommendation>,
    onSelectProduct: (String) -> Unit,
    onSelectTab: (BusinessTab) -> Unit,
) {
    val productBySku = products.associateBy(Product::sku)
    val buySkus = recommendations
        .filter { it.status.equals("COMPRAR", ignoreCase = true) }
        .mapTo(mutableSetOf(), Recommendation::sku)
    val inventoryBySku = inventory.associateBy(InventoryItem::sku)
    val buyProducts = recommendations
        .filter { it.status.equals("COMPRAR", ignoreCase = true) }
        .mapNotNull { productBySku[it.sku] }
    val usesSyntheticData = inventory.any(InventoryItem::synthetic) || recommendations.any(Recommendation::syntheticForecast)

    item {
        Column(verticalArrangement = Arrangement.spacedBy(MoreStockSpacing.xSmall)) {
            Text("Resumen de ${business.name}", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.semantics { heading() })
            Text("Esto es lo que necesita atención hoy.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
    if (usesSyntheticData) {
        item { SyntheticDataBanner(message = "Parte de esta información usa datos sintéticos de demostración.") }
    }
    item {
        Column(verticalArrangement = Arrangement.spacedBy(MoreStockSpacing.xSmall)) {
            Text("Atención primero", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold, modifier = Modifier.semantics { heading() })
            Text("Productos que la recomendación marca para comprar.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
    if (buyProducts.isEmpty()) {
        item { EmptyState("No hay productos marcados para compra.") }
    } else {
        items(buyProducts, key = Product::sku) { product ->
            productCard(product, inventoryBySku[product.sku], recommendations.firstOrNull { it.sku == product.sku }, onSelectProduct)
        }
    }
    item {
        Row(horizontalArrangement = Arrangement.spacedBy(MoreStockSpacing.small)) {
            MetricCard("Productos", products.size.toString(), Modifier.weight(1f))
            MetricCard("Con inventario", inventory.size.toString(), Modifier.weight(1f))
            MetricCard("Por comprar", buyProducts.size.toString(), Modifier.weight(1f))
        }
    }
    item {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Productos del negocio", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold, modifier = Modifier.semantics { heading() })
            TextButton(onClick = { onSelectTab(BusinessTab.CATALOG) }) { Text("Ver todos") }
        }
    }
    val otherProducts = products.filterNot { it.sku in buySkus }.take(5)
    if (products.isEmpty()) {
        item { EmptyState("No hay productos disponibles para este negocio.") }
    } else if (otherProducts.isEmpty()) {
        item { EmptyState("Todos los productos aparecen en la sección de atención.") }
    } else {
        items(otherProducts, key = Product::sku) { product ->
            productCard(product, inventoryBySku[product.sku], recommendations.firstOrNull { it.sku == product.sku }, onSelectProduct)
        }
    }
    item {
        TextButton(onClick = { onSelectTab(BusinessTab.RECOMMENDATIONS) }, modifier = Modifier.fillMaxWidth()) {
            Text("Ver todas las sugerencias")
        }
    }
}

private fun LazyListScope.catalogContent(
    products: List<Product>,
    allProducts: List<Product>,
    inventory: List<InventoryItem>,
    recommendations: List<Recommendation>,
    categories: List<String>,
    search: String,
    onSearchChange: (String) -> Unit,
    selectedCategory: String,
    onCategorySelected: (String) -> Unit,
    selectedRecommendation: RecommendationFilter,
    onRecommendationSelected: (RecommendationFilter) -> Unit,
    selectedSort: ProductSort,
    onSortSelected: (ProductSort) -> Unit,
    onResetFilters: () -> Unit,
    onSelectProduct: (String) -> Unit,
) {
    val inventoryBySku = inventory.associateBy(InventoryItem::sku)
    val recommendationBySku = recommendations.associateBy(Recommendation::sku)
    item {
        Column(verticalArrangement = Arrangement.spacedBy(MoreStockSpacing.medium)) {
            Text("Productos", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.semantics { heading() })
            Text("Busca y filtra el catálogo de este negocio.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            OutlinedTextField(
                value = search,
                onValueChange = onSearchChange,
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Buscar producto") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text, imeAction = ImeAction.Search),
            )
            ProductFilterRow(
                title = "Categoría",
                values = listOf("Todas") + categories,
                selectedValue = selectedCategory.ifBlank { "Todas" },
                onSelect = { onCategorySelected(if (it == "Todas") "" else it) },
            )
            ProductFilterRow(
                title = "Recomendación",
                values = listOf("Todas", "COMPRAR", "MANTENER", "NO COMPRAR"),
                selectedValue = selectedRecommendation.label,
                onSelect = { label ->
                    onRecommendationSelected(RecommendationFilter.entries.first { it.label == label })
                },
            )
            ProductSortMenu(selectedSort, onSortSelected)
        }
    }
    when {
        allProducts.isEmpty() -> item { EmptyState("No hay productos disponibles para este negocio.") }
        products.isEmpty() -> item {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                EmptyState("No hay productos que coincidan con estos filtros.")
                TextButton(onClick = onResetFilters) { Text("Quitar filtros") }
            }
        }
        else -> items(products, key = Product::sku) { product ->
            productCard(product, inventoryBySku[product.sku], recommendationBySku[product.sku], onSelectProduct)
        }
    }
}

@Composable
private fun ProductFilterRow(
    title: String,
    values: List<String>,
    selectedValue: String,
    onSelect: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(MoreStockSpacing.xSmall)) {
        Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Medium)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(MoreStockSpacing.small)) {
            items(values) { value ->
                FilterChip(
                    selected = value == selectedValue,
                    onClick = { onSelect(value) },
                    label = { Text(value) },
                )
            }
        }
        if (values.size >= 3) {
            Text(
                "Desliza para ver más opciones",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun ProductSortMenu(selectedSort: ProductSort, onSelect: (ProductSort) -> Unit) {
    var expanded by rememberSaveable { mutableStateOf(false) }
    androidx.compose.foundation.layout.Box {
        TextButton(onClick = { expanded = true }) {
            Text("Orden: ${selectedSort.label}")
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            ProductSort.entries.forEach { sort ->
                DropdownMenuItem(
                    text = { Text(sort.label) },
                    onClick = {
                        onSelect(sort)
                        expanded = false
                    },
                )
            }
        }
    }
}

private fun LazyListScope.inventoryContent(
    inventory: List<InventoryItem>,
    products: List<Product>,
    onSelectProduct: (String) -> Unit,
) {
    val productBySku = products.associateBy(Product::sku)
    item {
        Column(verticalArrangement = Arrangement.spacedBy(MoreStockSpacing.xSmall)) {
            Text("Inventario", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.semantics { heading() })
            Text("Existencias registradas para este negocio.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
    if (inventory.isEmpty()) {
        item { EmptyState("No se encontró inventario para mostrar.") }
    } else {
        items(inventory, key = InventoryItem::sku) { item ->
            val product = productBySku[item.sku]
            ProductCard(
                name = item.productName,
                stockLabel = "${formatAmount(item.quantity)} ${item.unit}",
                category = product?.category,
                isSynthetic = item.synthetic,
                onClick = { onSelectProduct(item.sku) },
            )
        }
    }
}

private fun LazyListScope.recommendationContent(
    recommendations: List<Recommendation>,
    onSelectProduct: (String) -> Unit,
) {
    item {
        Column(verticalArrangement = Arrangement.spacedBy(MoreStockSpacing.xSmall)) {
            Text("Sugerencias", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.semantics { heading() })
            Text("Decisiones y cantidades recibidas para tu negocio.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
    if (recommendations.isEmpty()) {
        item { EmptyState("No hay recomendaciones disponibles para este negocio.") }
    } else {
        items(recommendations, key = Recommendation::sku) { recommendation ->
            RecommendationCard(recommendation) { onSelectProduct(recommendation.sku) }
        }
    }
}

@Composable
private fun RecommendationCard(recommendation: Recommendation, onClick: () -> Unit) {
    androidx.compose.material3.Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
    ) {
        Column(
            modifier = Modifier.padding(MoreStockSpacing.large),
            verticalArrangement = Arrangement.spacedBy(MoreStockSpacing.small),
        ) {
            Text(recommendation.productName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            RecommendationBadge(recommendation.status.replace('_', ' '), recommendation.status.toRecommendationState())
            Text(
                "Compra sugerida: ${formatAmount(recommendation.suggestedQuantity)} ${recommendation.unit}",
                style = MaterialTheme.typography.bodyMedium,
            )
            if (recommendation.explanation.isNotBlank()) {
                Text(recommendation.explanation, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (recommendation.syntheticForecast) SyntheticDataBanner()
        }
    }
}

@Composable
private fun productCard(
    product: Product,
    inventory: InventoryItem?,
    recommendation: Recommendation?,
    onSelectProduct: (String) -> Unit,
) {
    val stock = inventory?.let { "Inventario: ${formatAmount(it.quantity)} ${it.unit}" }
        ?: product.inventoryQuantity?.let { "Existencia de catálogo: ${formatAmount(it)} ${product.unit} · origen no indicado" }
        ?: "Inventario sin registrar · ${product.unit}"
    val status = recommendation?.status
    ProductCard(
        name = product.name,
        stockLabel = stock,
        category = product.category,
        isSynthetic = inventory?.synthetic == true || recommendation?.syntheticForecast == true,
        recommendation = status?.let {
            ProductRecommendation(label = it.replace('_', ' '), state = it.toRecommendationState())
        },
        onClick = { onSelectProduct(product.sku) },
    )
}

private fun String.toRecommendationState(): RecommendationState = when (uppercase(Locale.ROOT)) {
    "COMPRAR" -> RecommendationState.BUY
    "MANTENER" -> RecommendationState.MAINTAIN
    "NO_COMPRAR", "NO COMPRAR" -> RecommendationState.DO_NOT_BUY
    else -> RecommendationState.UNKNOWN
}

private val RecommendationFilter.label: String
    get() = when (this) {
        RecommendationFilter.ALL -> "Todas"
        RecommendationFilter.BUY -> "COMPRAR"
        RecommendationFilter.MAINTAIN -> "MANTENER"
        RecommendationFilter.DO_NOT_BUY -> "NO COMPRAR"
    }

private val ProductSort.label: String
    get() = when (this) {
        ProductSort.NAME_ASC -> "nombre A–Z"
        ProductSort.NAME_DESC -> "nombre Z–A"
        ProductSort.BUY_FIRST -> "COMPRAR primero"
    }

private val BusinessTab.label: String
    get() = when (this) {
        BusinessTab.SUMMARY -> "Inicio"
        BusinessTab.CATALOG -> "Productos"
        BusinessTab.INVENTORY -> "Inventario"
        BusinessTab.RECOMMENDATIONS -> "Sugerencias"
    }

@Composable
private fun BusinessTabGlyph(tab: BusinessTab, selected: Boolean) {
    val color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
    Canvas(
        modifier = Modifier.size(24.dp).clearAndSetSemantics {},
    ) {
        val stroke = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round)
        when (tab) {
            BusinessTab.SUMMARY -> {
                val roof = Path().apply {
                    moveTo(size.width * 0.12f, size.height * 0.46f)
                    lineTo(size.width * 0.5f, size.height * 0.14f)
                    lineTo(size.width * 0.88f, size.height * 0.46f)
                }
                drawPath(roof, color, style = stroke)
                drawLine(color, Offset(size.width * 0.22f, size.height * 0.42f), Offset(size.width * 0.22f, size.height * 0.88f), 2.dp.toPx())
                drawLine(color, Offset(size.width * 0.78f, size.height * 0.42f), Offset(size.width * 0.78f, size.height * 0.88f), 2.dp.toPx())
                drawLine(color, Offset(size.width * 0.22f, size.height * 0.88f), Offset(size.width * 0.78f, size.height * 0.88f), 2.dp.toPx())
                drawRect(color, topLeft = Offset(size.width * 0.43f, size.height * 0.62f), size = androidx.compose.ui.geometry.Size(size.width * 0.14f, size.height * 0.26f))
            }
            BusinessTab.CATALOG -> {
                drawRoundRect(color, topLeft = Offset(size.width * 0.2f, size.height * 0.12f), size = androidx.compose.ui.geometry.Size(size.width * 0.6f, size.height * 0.76f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(3.dp.toPx()), style = stroke)
                for (index in 0..2) {
                    val y = size.height * (0.34f + index * 0.2f)
                    drawLine(color, Offset(size.width * 0.32f, y), Offset(size.width * 0.68f, y), 1.8.dp.toPx(), cap = StrokeCap.Round)
                }
            }
            BusinessTab.INVENTORY -> {
                for (row in 0..1) for (column in 0..1) {
                    drawRoundRect(
                        color,
                        topLeft = Offset(size.width * (0.18f + column * 0.36f), size.height * (0.18f + row * 0.36f)),
                        size = androidx.compose.ui.geometry.Size(size.width * 0.28f, size.height * 0.28f),
                        cornerRadius = androidx.compose.ui.geometry.CornerRadius(2.dp.toPx()),
                        style = stroke,
                    )
                }
            }
            BusinessTab.RECOMMENDATIONS -> {
                val check = Path().apply {
                    moveTo(size.width * 0.16f, size.height * 0.52f)
                    lineTo(size.width * 0.4f, size.height * 0.76f)
                    lineTo(size.width * 0.84f, size.height * 0.25f)
                }
                drawPath(check, color, style = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round))
            }
        }
    }
}

private fun formatAmount(value: Double): String =
    if (value % 1.0 == 0.0) value.toLong().toString() else "%.2f".format(value)
