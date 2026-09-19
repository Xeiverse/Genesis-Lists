package uk.co.xeiverse.genesislists.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ReceiptLong
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import uk.co.xeiverse.genesislists.ui.theme.BrandPrimary

@Composable
fun BrandMark(
    modifier: Modifier = Modifier,
    size: Dp = 48.dp,
    inverted: Boolean = false,
) {
    val bg = if (inverted) MaterialTheme.colorScheme.surface else BrandPrimary
    val fg = if (inverted) BrandPrimary else Color.White
    Box(
        modifier = modifier
            .size(size)
            .clip(RoundedCornerShape(size * 0.22f))
            .background(bg),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = Icons.AutoMirrored.Outlined.ReceiptLong,
            contentDescription = null,
            tint = fg,
            modifier = Modifier.size(size * 0.58f),
        )
    }
}
