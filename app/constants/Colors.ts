interface ThemeColors {
  text: string;
  background: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;
}

interface ColorScheme {
  light: ThemeColors;
  dark: ThemeColors;
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: {
    primary: string;
    secondary: string;
    dark: string;
  };
  border: string;
  success: string;
  error: string;
}

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors: ColorScheme = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
  primary: '#1E2F4D',    // Dark blue
  secondary: '#4A90E2',  // Light blue for accents
  background: '#121826', // Darker blue for background
  surface: '#2A3C5A',    // Lighter blue for cards/inputs
  text: {
    primary: '#FFFFFF',
    secondary: '#B0B9C6',
    dark: '#1E2F4D',
  },
  border: '#374869',     // Subtle blue border
  success: '#4CAF50',    // Keep green for success states
  error: '#FF4B4B',      // Red for errors
};

export default Colors; 