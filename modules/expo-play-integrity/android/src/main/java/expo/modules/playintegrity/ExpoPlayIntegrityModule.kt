package expo.modules.playintegrity

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.records.Field
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.StandardIntegrityManager
import com.google.android.play.core.integrity.StandardIntegrityManager.StandardIntegrityTokenProvider
import com.google.android.play.core.integrity.StandardIntegrityManager.StandardIntegrityTokenRequest
import com.google.android.play.core.integrity.StandardIntegrityManager.StandardIntegrityToken
import com.google.android.play.core.integrity.StandardIntegrityManager.PrepareIntegrityTokenRequest
import com.google.android.play.core.integrity.model.StandardIntegrityErrorCode
import com.google.android.gms.tasks.Tasks
import java.util.concurrent.TimeUnit

class IntegrityRequestArgs : Record {
  @Field val requestHash: String = ""
  @Field val cloudProjectNumber: Long = 0L
}

class ExpoPlayIntegrityModule : Module() {
  private var cachedManager: StandardIntegrityManager? = null

  @Volatile
  private var cachedProvider: StandardIntegrityTokenProvider? = null

  @Volatile
  private var isPreparing = false

  private val providerLock = Any()

  private fun getManager(cloudProjectNumber: Long): StandardIntegrityManager {
    cachedManager?.let { return it }
    val context = appContext.reactContext?.applicationContext
      ?: throw IllegalStateException("PI_NO_CONTEXT: Application context is not available")
    val manager = IntegrityManagerFactory.createStandard(context)
    cachedManager = manager
    return manager
  }

  private fun getOrPrepareProvider(cloudProjectNumber: Long): StandardIntegrityTokenProvider {
    cachedProvider?.let { return it }
    synchronized(providerLock) {
      cachedProvider?.let { return it }
      if (isPreparing) {
        throw IllegalStateException("PI_PROVIDER_PREPARATION_IN_PROGRESS")
      }
      isPreparing = true
      try {
        val manager = getManager(cloudProjectNumber)
        val prepareRequest = PrepareIntegrityTokenRequest.builder()
          .setCloudProjectNumber(cloudProjectNumber)
          .build()
        val provider = Tasks.await(
          manager.prepareIntegrityToken(prepareRequest),
          30,
          TimeUnit.SECONDS,
        )
        cachedProvider = provider
        return provider
      } finally {
        isPreparing = false
      }
    }
  }

  private fun requestTokenFromProvider(
    provider: StandardIntegrityTokenProvider,
    requestHash: String,
  ): String {
    val request = StandardIntegrityTokenRequest.builder()
      .setRequestHash(requestHash)
      .build()
    val response: StandardIntegrityToken = Tasks.await(
      provider.request(request),
      30,
      TimeUnit.SECONDS,
    )
    val token = response.token()
    if (token.isNullOrEmpty()) {
      throw IllegalStateException("PI_EMPTY_TOKEN: Play Integrity returned an empty token")
    }
    return token
  }

  override fun definition() = ModuleDefinition {
    Name("ExpoPlayIntegrity")

    AsyncFunction("requestIntegrityToken") { args: IntegrityRequestArgs ->
      val requestHash = args.requestHash
      if (requestHash.isEmpty()) {
        throw IllegalArgumentException("requestHash is required")
      }
      val cloudProjectNumber = args.cloudProjectNumber
      if (cloudProjectNumber == 0L) {
        throw IllegalArgumentException("cloudProjectNumber is required")
      }

      val provider = getOrPrepareProvider(cloudProjectNumber)

      try {
        return@AsyncFunction requestTokenFromProvider(provider, requestHash)
      } catch (e: com.google.android.gms.common.api.ApiException) {
        if (e.statusCode == StandardIntegrityErrorCode.INTEGRITY_TOKEN_PROVIDER_INVALID) {
          cachedProvider = null
          val newProvider = getOrPrepareProvider(cloudProjectNumber)
          return@AsyncFunction requestTokenFromProvider(newProvider, requestHash)
        }
        val code = when (e.statusCode) {
          com.google.android.gms.common.api.CommonStatusCodes.NETWORK_ERROR -> "PI_NETWORK_ERROR"
          com.google.android.gms.common.api.CommonStatusCodes.DEVELOPER_ERROR -> "PI_DEVELOPER_ERROR"
          com.google.android.gms.common.api.CommonStatusCodes.INTERNAL_ERROR -> "PI_INTERNAL_ERROR"
          com.google.android.gms.common.api.CommonStatusCodes.SERVICE_DISABLED -> "PI_SERVICE_DISABLED"
          StandardIntegrityErrorCode.API_NOT_AVAILABLE -> "PI_API_NOT_AVAILABLE"
          StandardIntegrityErrorCode.PLAY_STORE_NOT_FOUND -> "PI_PLAY_STORE_NOT_FOUND"
          StandardIntegrityErrorCode.PLAY_SERVICES_NOT_FOUND -> "PI_PLAY_SERVICES_NOT_FOUND"
          StandardIntegrityErrorCode.TOO_MANY_REQUESTS -> "PI_TOO_MANY_REQUESTS"
          StandardIntegrityErrorCode.CLOUD_PROJECT_NUMBER_IS_INVALID -> "PI_CLOUD_PROJECT_NUMBER_INVALID"
          StandardIntegrityErrorCode.CLIENT_TRANSIENT_ERROR -> "PI_CLIENT_TRANSIENT_ERROR"
          com.google.android.gms.common.api.CommonStatusCodes.SERVICE_VERSION_UPDATE_REQUIRED -> "PI_PLAY_SERVICES_OUTDATED"
          else -> "PI_API_ERROR_${e.statusCode}"
        }
        throw IllegalStateException("$code: ${e.message}")
      } catch (e: java.util.concurrent.TimeoutException) {
        throw IllegalStateException("PI_TIMEOUT: ${e.message}")
      } catch (e: Exception) {
        throw IllegalStateException("PI_UNKNOWN: ${e.message}")
      }
    }

    AsyncFunction("clearCache") {
      cachedProvider = null
      cachedManager = null
      return@AsyncFunction null
    }
  }
}
