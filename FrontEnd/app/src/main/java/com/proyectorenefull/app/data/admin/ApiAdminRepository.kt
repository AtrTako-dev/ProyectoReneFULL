package com.proyectorenefull.app.data.admin

import com.proyectorenefull.app.data.remote.ApiCallResult
import com.proyectorenefull.app.data.remote.ApiErrorMapper
import com.proyectorenefull.app.data.remote.ClienteApi
import com.proyectorenefull.app.model.admin.AdminCategoryStatistic
import com.proyectorenefull.app.model.admin.AdminRepository
import com.proyectorenefull.app.model.admin.AdminStatistics
import com.proyectorenefull.app.model.admin.AdminUser
import com.proyectorenefull.app.model.client.ClientResult
import org.json.JSONArray
import org.json.JSONObject
import java.math.BigDecimal

class ApiAdminRepository(private val api: ClienteApi) : AdminRepository {
    override fun statistics(onResult: (ClientResult<AdminStatistics>) -> Unit) {
        api.request("GET", "/api/admin/estadisticas/ventas?agrupacion=semana") { result ->
            val response = result as? ApiCallResult.Response
            if (response?.status != 200) {
                onResult(ApiErrorMapper.clientFailure(result))
                return@request
            }
            val body = response.body
            if (body == null) {
                onResult(ClientResult.Failure("La respuesta administrativa no tiene el formato esperado."))
                return@request
            }
            runCatching { body.toAdminStatistics() }
                .onSuccess { onResult(ClientResult.Success(it)) }
                .onFailure { onResult(ClientResult.Failure("No se pudieron leer las estadísticas recibidas.")) }
        }
    }

    override fun clients(onResult: (ClientResult<List<AdminUser>>) -> Unit) {
        api.request("GET", "/api/admin/usuarios") { result ->
            val response = result as? ApiCallResult.Response
            if (response?.status != 200) {
                onResult(ApiErrorMapper.clientFailure(result))
                return@request
            }
            val users = response.body?.optJSONArray("usuarios")
            if (users == null) {
                onResult(ClientResult.Failure("La respuesta de usuarios no tiene el formato esperado."))
                return@request
            }
            runCatching { users.toAdminUsers().filter { it.role == "cliente" } }
                .onSuccess { onResult(ClientResult.Success(it)) }
                .onFailure { onResult(ClientResult.Failure("No se pudieron leer las cuentas recibidas.")) }
        }
    }

    override fun changeRole(
        userId: String,
        role: String,
        onResult: (ClientResult<AdminUser>) -> Unit
    ) {
        val body = JSONObject().put("rol", role)
        api.request("PATCH", "/api/admin/usuarios/$userId/rol", body) { result ->
            val response = result as? ApiCallResult.Response
            if (response?.status != 200) {
                onResult(ApiErrorMapper.clientFailure(result))
                return@request
            }
            val user = response.body?.optJSONObject("usuario")
            if (user == null) {
                onResult(ClientResult.Failure("La respuesta del cambio de rol no tiene el formato esperado."))
                return@request
            }
            runCatching { user.toAdminUser() }
                .onSuccess { onResult(ClientResult.Success(it)) }
                .onFailure { onResult(ClientResult.Failure("No se pudo leer el usuario actualizado.")) }
        }
    }

    private fun JSONObject.toAdminStatistics(): AdminStatistics {
        val summaryObject = getJSONObject("resumen")
        val periodObject = getJSONObject("periodo")
        val categories = optJSONArray("por_categoria") ?: JSONArray()
        val grouping = when (periodObject.optString("agrupacion")) {
            "mes" -> "Por mes"
            else -> "Por semana"
        }
        val start = periodObject.optionalString("desde")
        val end = periodObject.optionalString("hasta")
        val range = listOfNotNull(start, end).joinToString(" – ")
        return AdminStatistics(
            unit = optString("unidad_cantidad", "unidades"),
            period = if (range.isBlank()) grouping else "$grouping · $range",
            summary = listOf(
                "Transacciones" to summaryObject.getInt("transacciones_validas").toString(),
                "Unidades" to summaryObject.getInt("unidades").toString(),
                "Importe total" to "${summaryObject.decimal("importe_mxn").toPlainString()} MXN",
                "Clientes" to summaryObject.getInt("total_clientes").toString(),
                "Registros excluidos" to summaryObject.getInt("registros_excluidos").toString()
            ),
            categories = categories.toCategoryStatistics()
        )
    }

    private fun JSONArray.toCategoryStatistics(): List<AdminCategoryStatistic> =
        List(length()) { index ->
            val row = getJSONObject(index)
            AdminCategoryStatistic(
                category = row.getString("categoria"),
                transactions = row.getInt("transacciones"),
                units = row.getInt("unidades"),
                amountMxn = row.decimal("importe_mxn")
            )
        }

    private fun JSONArray.toAdminUsers(): List<AdminUser> = List(length()) { index ->
        getJSONObject(index).toAdminUser()
    }

    private fun JSONObject.toAdminUser(): AdminUser = AdminUser(
        id = getString("id"),
        name = getString("nombre"),
        email = getString("correo"),
        role = getString("rol"),
        active = getBoolean("activo")
    )

    private fun JSONObject.decimal(key: String): BigDecimal = BigDecimal(get(key).toString())

    private fun JSONObject.optionalString(key: String): String? =
        if (isNull(key)) null else optString(key).takeIf { it.isNotBlank() }
}
