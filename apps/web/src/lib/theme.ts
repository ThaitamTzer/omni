import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface TypeBackground {
    surface2: string;
  }
  interface Palette {
    custom: { staffBubble: string };
  }
  interface PaletteOptions {
    custom?: { staffBubble: string };
  }
}

export const theme = createTheme({
  palette: {
    mode: 'light',
    // Primary: operational blue — inbox/messaging domain (kept per user direction)
    primary: { main: '#2563eb', dark: '#1d4ed8', light: '#60a5fa', contrastText: '#ffffff' },
    // Secondary: reserved exclusively for AI state
    secondary: { main: '#6d28d9', dark: '#5b21b6' },
    info: { main: '#0288d1', dark: '#01579b' },
    success: { main: '#22c55e' },
    background: { default: '#f3f4f6', paper: '#ffffff', surface2: '#f9fafb' },
    text: { primary: '#111827', secondary: '#6b7280' },
    divider: '#e5e7eb',
    custom: { staffBubble: '#111827' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButtonBase: {
      styleOverrides: {
        root: {
          transition: 'transform 150ms ease-out, background-color 150ms ease-out',
          '&:active': { transform: 'scale(0.98)' },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 6 } },
    },
    MuiPaper: {
      styleOverrides: { root: ({ theme }) => ({ border: `1px solid ${theme.palette.divider}` }) },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600 } },
    },
    MuiListItemButton: {
      styleOverrides: { root: { borderRadius: 6, marginBottom: 2 } },
    },
  },
});
