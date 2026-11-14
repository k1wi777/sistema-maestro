export const THEME_STORAGE_KEY = 'gns-theme';

export type ThemeChoice = 'system' | 'light' | 'dark';

function isExplicitTheme(value: string | null): value is 'light' | 'dark' {
  return value === 'light' || value === 'dark';
}

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isExplicitTheme(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function applyThemeChoice(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', choice);
  }
}

// La preferencia es del navegador (no es un dato personal y no viaja al servidor).
export function saveThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'system') {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, choice);
    }
  } catch {
    // Sin almacenamiento disponible: el tema solo dura mientras la pestaña esté abierta.
  }
  applyThemeChoice(choice);
}

// Script en línea para el <head>: aplica el tema antes de pintar y evita el parpadeo.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;
