import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { Box } from "@mui/material";

type AppMarkProps = {
  size?: number;
  /** Light tile for the primary app bar, where the green mark would disappear. */
  inverted?: boolean;
};

export function AppMark({ size = 40, inverted = false }: AppMarkProps) {
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: "22%",
        bgcolor: inverted ? "primary.contrastText" : "primary.main",
        color: inverted ? "primary.main" : "primary.contrastText",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <ReceiptLongIcon sx={{ fontSize: Math.round(size * 0.68) }} />
    </Box>
  );
}
