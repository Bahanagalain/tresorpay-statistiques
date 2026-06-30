import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const ThemeContext = createContext({
  theme: 'light',
  isDark: false,
  setTheme: () => {},
  toggleTheme: () => {},
});

function isValidTheme(value) {
  return value === 'light' || value === 'dark';
}

function getInitialTheme() {
  if (typeof document !== 'undefined') {
    const domTheme = document.documentElement.getAttribute('data-theme');
    if (isValidTheme(domTheme)) return domTheme;
  }

  if (typeof window !== 'undefined') {
    const storedTheme = window.localStorage.getItem('theme');
    if (isValidTheme(storedTheme)) return storedTheme;
  }

  return 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  const setTheme = useCallback((nextTheme) => {
    setThemeState(isValidTheme(nextTheme) ? nextTheme : 'light');
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark');
  }, []);

  const value = useMemo(() => ({
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme,
  }), [setTheme, theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
