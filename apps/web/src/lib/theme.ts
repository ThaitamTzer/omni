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
    // Primary: operational blue — inbox/messaging domain, per user direction
    primary: { main: '#2563eb', dark: '#1d4ed8', light: '#60a5fa', contrastText: '#ffffff' },
    // Secondary: reserved exclusively for AI state
    secondary: { main: '#6d28d9', dark: '#5b21b6' },
    info: { main: '#0288d1', dark: '#01579b' },
    background: { default: '#f4f6fb', paper: '#ffffff', surface2: '#f8fafc' },
    text: { primary: '#1e293b', secondary: '#64748b' },
    divider: '#e2e8f0',
    custom: { staffBubble: '#111827' },
  },
  shape: { borderRadius: 10 },
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
      styleOverrides: { root: { borderRadius: 8 } },
    },
    MuiPaper: {
      styleOverrides: { root: ({ theme }) => ({ border: `1px solid ${theme.palette.divider}` }) },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600 } },
    },
    MuiListItemButton: {
      styleOverrides: { root: { borderRadius: 8, marginBottom: 2 } },
    },
  },
});
