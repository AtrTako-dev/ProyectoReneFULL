package com.proyectorenefull.app.data.remote

import android.os.Handler
import android.os.Looper
import com.proyectorenefull.app.data.session.SessionStore
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

sealed interface ApiCallResult {
    data class Response(val status: Int, val body: JSONObject?) : ApiCallResult
    data object NetworkFailure : ApiCallResult
}

class ClienteApi(
    private val baseUrl: String,
    private val sessionStore: SessionStore
) {
    fun request(
        method: String,
        path: String,
        body: JSONObject? = null,
        requiresAuth: Boolean = true,
        onResult: (ApiCallResult) -> Unit
    ) {
        executor.execute {
            val result = executeRequest(method, path, body, requiresAuth)
            mainHandler.post { onResult(result) }
        }
    }

    private fun executeRequest(
        method: String,
        path: String,
        body: JSONObject?,
        requiresAuth: Boolean
    ): ApiCallResult {
        val token = if (requiresAuth) sessionStore.token() else null
        if (requiresAuth && token == null) {
            return ApiCallResult.Response(status = 401, body = null)
        }

        var connection: HttpURLConnection? = null
        return try {
            val openedConnection = URL(baseUrl.trimEnd('/') + path).openConnection() as? HttpURLConnection
                ?: return ApiCallResult.NetworkFailure
            connection = openedConnection.apply {
                requestMethod = method
                connectTimeout = CONNECT_TIMEOUT_MILLIS
                readTimeout = READ_TIMEOUT_MILLIS
                useCaches = false
                doInput = true
                setRequestProperty("Accept", "application/json")
                token?.let { setRequestProperty("Authorization", "Bearer $it") }
                if (body != null) {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                }
            }
            if (body != null) {
                connection.outputStream.use { output ->
                    output.write(body.toString().toByteArray(Charsets.UTF_8))
                }
            }

            val status = connection.responseCode
            if (requiresAuth && status == 401) sessionStore.clear()
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val responseText = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val responseBody = responseText.takeIf(String::isNotBlank)?.let {
                runCatching { JSONObject(it) }.getOrNull()
            }
            ApiCallResult.Response(status, responseBody)
        } catch (_: IOException) {
            ApiCallResult.NetworkFailure
        } finally {
            connection?.disconnect()
        }
    }

    companion object {
        private const val CONNECT_TIMEOUT_MILLIS = 10_000
        private const val READ_TIMEOUT_MILLIS = 15_000
        private val executor = Executors.newCachedThreadPool()
        private val mainHandler = Handler(Looper.getMainLooper())
    }
}
