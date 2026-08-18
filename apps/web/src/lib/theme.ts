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
    // Primary: operational blue — used sparingly for actions, active states, focus
    primary: { main: '#1d4ed8', dark: '#1e40af', light: '#2563eb', contrastText: '#ffffff' },
    // Secondary: reserved exclusively for AI state
    secondary: { main: '#6d28d9', dark: '#5b21b6' },
    info: { main: '#0284c7', dark: '#075985' },
    success: { main: '#16a34a', dark: '#15803d' },
    warning: { main: '#d97706', dark: '#b45309' },
    error: { main: '#dc2626', dark: '#b91c1c' },
    background: { default: '#f5f6f8', paper: '#ffffff', surface2: '#fafbfc' },
    text: { primary: '#17202a', secondary: '#5b6572' },
    divider: '#e2e5ea',
    custom: { staffBubble: '#17202a' },
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontSize: 14,
    h6: { fontSize: 18, fontWeight: 700 },
    body2: { fontSize: 13 },
    caption: { fontSize: 12 },
    button: { textTransform: 'none', fontWeight: 600, fontSize: 13 },
  },
  components: {
    MuiButtonBase: {
      styleOverrides: {
        root: {
          transition: 'background-color 120ms ease-out',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 6, padding: '5px 14px' } },
    },
    MuiPaper: {
      styleOverrides: { root: ({ theme }) => ({ border: `1px solid ${theme.palette.divider}` }) },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: 6, fontWeight: 600, height: 22, fontSize: 11 } },
    },
    MuiListItemButton: {
      styleOverrides: { root: { borderRadius: 6 } },
    },
    MuiOutlinedInput: {
      styleOverrides: { root: { borderRadius: 6 } },
    },
    MuiTextField: {
      styleOverrides: { root: { '& .MuiOutlinedInput-root': { borderRadius: 6 } } },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: { height: 2, backgroundColor: '#1d4ed8' },
        root: { minHeight: 40 },
      },
    },
    MuiTab: {
      styleOverrides: { root: { minHeight: 40, fontSize: 13, fontWeight: 600, textTransform: 'none' } },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 8 } },
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { fontSize: 12, borderRadius: 4 } },
    },
  },
});
