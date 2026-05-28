import { forwardRef } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import foxLogoDark from '@/assets/fox-portal-logo.png';
import foxLogoLight from '@/assets/fox-portal-logo-light.svg';

interface ThemeLogoProps {
  className?: string;
  alt?: string;
}

const ThemeLogo = forwardRef<HTMLImageElement, ThemeLogoProps>(function ThemeLogo(
  { className = 'h-7', alt = 'Fox Portal' },
  ref
) {
  const theme = useThemeStore((s) => s.theme);
  return <img ref={ref} src={theme === 'dark' ? foxLogoDark : foxLogoLight} alt={alt} className={className} />;
});

export default ThemeLogo;
