package com.genesislists.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val BrandPrimary = Color(0xFF386A20)
private val OnPrimary = Color(0xFFFFFFFF)
private val PrimaryContainer = Color(0xFFB7F397)
private val OnPrimaryContainer = Color(0xFF042100)
private val Surface = Color(0xFFF7FBF1)
private val OnSurface = Color(0xFF191D16)
private val SurfaceVariant = Color(0xFFDFE4D7)
private val Outline = Color(0xFF72796B)

private val LightColors = lightColorScheme(
    primary = BrandPrimary,
    onPrimary = OnPrimary,
    primaryContainer = PrimaryContainer,
    onPrimaryContainer = OnPrimaryContainer,
    secondary = BrandPrimary,
    onSecondary = OnPrimary,
    background = Surface,
    onBackground = OnSurface,
    surface = Surface,
    onSurface = OnSurface,
    surfaceVariant = SurfaceVariant,
    onSurfaceVariant = Color(0xFF43493E),
    outline = Outline,
    error = Color(0xFFBA1A1A),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF9CD67D),
    onPrimary = Color(0xFF0B3900),
    primaryContainer = Color(0xFF205107),
    onPrimaryContainer = PrimaryContainer,
    background = Color(0xFF11140E),
    onBackground = Color(0xFFE2E3DB),
    surface = Color(0xFF11140E),
    onSurface = Color(0xFFE2E3DB),
)

@Composable
fun GenesisListsTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content,
    )
}
