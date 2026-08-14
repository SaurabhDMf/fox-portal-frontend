import { forwardRef } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import foxLogoDark from '@/assets/fox-portal-logo.png';
import foxLogoLight from '@/assets/fox-portal-logo-light.svg';

interface ThemeLogoProps {
  className?: string;
  alt?: string;
  // Bypasses the app-wide theme and always renders the logo variant suited
  // for a dark or light background — for surfaces (like the sidebar) that
  // stay a fixed color regardless of the app's light/dark mode.
  forceVariant?: 'light' | 'dark';
}

const ThemeLogo = forwardRef<HTMLImageElement, ThemeLogoProps>(function ThemeLogo(
  { className = 'h-7', alt = 'Fox Portal', forceVariant },
  ref
) {
  const theme = useThemeStore((s) => s.theme);
  const variant = forceVariant ?? theme;
  return <img ref={ref} src={variant === 'dark' ? foxLogoDark : foxLogoLight} alt={alt} className={className} />;
});

export default ThemeLogo;
