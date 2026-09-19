package uk.co.xeiverse.genesislists.ui.screens.auth

import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import uk.co.xeiverse.genesislists.data.ListsRepository
import uk.co.xeiverse.genesislists.data.api.ApiException
import uk.co.xeiverse.genesislists.data.api.AuthConfigDto
import uk.co.xeiverse.genesislists.data.api.OAuthDeepLink
import uk.co.xeiverse.genesislists.ui.components.BrandMark
import kotlinx.coroutines.launch

@Composable
fun AuthScreen(
    repository: ListsRepository,
    onAuthenticated: () -> Unit,
    onChangeServer: () -> Unit,
    onSettings: () -> Unit,
    oauthTicket: String? = null,
    oauthError: String? = null,
    onOauthHandled: () -> Unit = {},
) {
    var registerMode by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var config by remember { mutableStateOf<AuthConfigDto?>(null) }
    var configLoadFailed by remember { mutableStateOf(false) }
    var configLoading by remember { mutableStateOf(true) }
    var autoLaunchAttempted by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    fun openOidc() {
        val url = repository.oidcStartUrl()
        if (url == null) {
            error = "Server URL is not configured"
            return
        }
        try {
            CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(url))
        } catch (e: Exception) {
            error = e.message ?: "Could not open browser"
        }
    }

    suspend fun loadConfig() {
        configLoading = true
        configLoadFailed = false
        try {
            config = repository.authConfig()
        } catch (_: Exception) {
            config = null
            configLoadFailed = true
        } finally {
            configLoading = false
        }
    }

    LaunchedEffect(Unit) {
        if (repository.hasSession()) {
            try {
                repository.me()
                onAuthenticated()
                return@LaunchedEffect
            } catch (_: Exception) {
                // stale session — fall through to config load
            }
        }
        loadConfig()
    }

    LaunchedEffect(oauthTicket, oauthError) {
        when {
            oauthError != null -> {
                error = "OIDC sign-in failed"
                onOauthHandled()
            }
            oauthTicket != null -> {
                if (!OAuthDeepLink.shouldExchangeOidcTicket(repository.hasSession(), oauthTicket)) {
                    onOauthHandled()
                    if (repository.hasSession()) {
                        onAuthenticated()
                    }
                    return@LaunchedEffect
                }
                busy = true
                error = null
                try {
                    repository.exchangeOidcTicket(oauthTicket)
                    onOauthHandled()
                    onAuthenticated()
                } catch (e: ApiException) {
                    error = e.message
                    onOauthHandled()
                } catch (e: Exception) {
                    error = e.message ?: "OIDC exchange failed"
                    onOauthHandled()
                } finally {
                    busy = false
                }
            }
        }
    }

    val passwordLogin = AuthConfigUi.showPasswordForm(config)
    val registrationOpen = AuthConfigUi.registrationOpen(config)
    val oidcPresentation = AuthConfigUi.oidcPresentation(config)
    val oidcButtonText = AuthConfigUi.oidcButtonText(config?.oidc)
    val showOidcButton = oidcPresentation == AuthConfigUi.OidcPresentation.Button
    val showOidcUpgrade = oidcPresentation == AuthConfigUi.OidcPresentation.UpgradeMessage
    val blockOnConfig = configLoadFailed && !repository.hasSession()

    LaunchedEffect(config, oauthTicket, oauthError) {
        if (
            !autoLaunchAttempted &&
            config?.oidc?.autoLaunch == true &&
            showOidcButton &&
            oauthTicket == null &&
            oauthError == null &&
            !repository.hasSession()
        ) {
            autoLaunchAttempted = true
            openOidc()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        BrandMark(size = 56.dp)
        Spacer(Modifier.height(12.dp))
        Text("Genesis Lists", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(4.dp))
        Text(
            if (registerMode) "Create an account" else "Sign in",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(24.dp))

        when {
            configLoading && config == null && !configLoadFailed -> {
                CircularProgressIndicator()
            }
            blockOnConfig -> {
                Text(
                    "Could not load sign-in options from the server.",
                    color = MaterialTheme.colorScheme.error,
                )
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = {
                        scope.launch {
                            error = null
                            loadConfig()
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Retry") }
            }
            else -> {
                if (passwordLogin) {
                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it; error = null },
                        label = { Text("Email") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !busy,
                    )
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it; error = null },
                        label = { Text("Password") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !busy,
                    )
                    Spacer(Modifier.height(16.dp))
                    Button(
                        onClick = {
                            scope.launch {
                                busy = true
                                error = null
                                try {
                                    if (registerMode) {
                                        repository.register(email.trim(), password)
                                    } else {
                                        repository.login(email.trim(), password)
                                    }
                                    onAuthenticated()
                                } catch (e: ApiException) {
                                    error = e.message
                                } catch (e: Exception) {
                                    error = e.message ?: "Authentication failed"
                                } finally {
                                    busy = false
                                }
                            }
                        },
                        enabled = !busy && email.contains("@") && password.length >= 8,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        if (busy) CircularProgressIndicator(
                            modifier = Modifier.height(20.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary,
                        ) else Text(if (registerMode) "Register" else "Sign in")
                    }
                    if (registrationOpen) {
                        Spacer(Modifier.height(8.dp))
                        TextButton(onClick = { registerMode = !registerMode; error = null }) {
                            Text(
                                if (registerMode) "Already have an account? Sign in"
                                else "Need an account? Register",
                            )
                        }
                    }
                } else if (config?.oidc?.enabled == false) {
                    Text(
                        "Password login and OIDC are both disabled on this server.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                if (showOidcButton) {
                    if (passwordLogin) {
                        Spacer(Modifier.height(16.dp))
                        HorizontalDivider()
                        Spacer(Modifier.height(16.dp))
                    } else {
                        Spacer(Modifier.height(8.dp))
                    }
                    if (passwordLogin) {
                        OutlinedButton(
                            onClick = { error = null; openOidc() },
                            enabled = !busy,
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text(oidcButtonText) }
                    } else {
                        Button(
                            onClick = { error = null; openOidc() },
                            enabled = !busy,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            if (busy) CircularProgressIndicator(
                                modifier = Modifier.height(20.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onPrimary,
                            ) else Text(oidcButtonText)
                        }
                    }
                } else if (showOidcUpgrade) {
                    if (passwordLogin) {
                        Spacer(Modifier.height(16.dp))
                        HorizontalDivider()
                        Spacer(Modifier.height(16.dp))
                    } else {
                        Spacer(Modifier.height(8.dp))
                    }
                    Text(
                        "This server does not support Android OAuth login yet. Upgrade Genesis Lists to a release that includes mobile OIDC (oidc.mobileLogin), then try again.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        error?.let {
            Spacer(Modifier.height(12.dp))
            Text(it, color = MaterialTheme.colorScheme.error)
        }

        Spacer(Modifier.height(16.dp))
        OutlinedButton(onClick = onChangeServer, modifier = Modifier.fillMaxWidth()) {
            Text("Change server")
        }
        TextButton(onClick = onSettings) {
            Icon(Icons.Default.Settings, contentDescription = null)
            Spacer(Modifier.width(4.dp))
            Text("Settings")
        }
        Row(Modifier.padding(top = 8.dp)) {
            Text(
                repository.getBaseUrl().orEmpty(),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
