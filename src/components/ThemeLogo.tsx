import { useThemeStore } from '@/stores/themeStore';
import foxLogoDark from '@/assets/fox-portal-logo.png';
import foxLogoLight from '@/assets/fox-portal-logo-light.svg';

interface ThemeLogoProps {
  className?: string;
  alt?: string;
}

export default function ThemeLogo({ className = 'h-7', alt = 'Fox Portal' }: ThemeLogoProps) {
  const theme = useThemeStore((s) => s.theme);
  return <img src={theme === 'dark' ? foxLogoDark : foxLogoLight} alt={alt} className={className} />;
}
