'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { MotionConfig } from 'motion/react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { Toaster } from 'sonner';
import type { ColorMode, FacilityRecord, SafeUser, ThemeKey } from '@/lib/types';
import { isValidColorMode, isValidThemeKey } from '@/lib/theme';

const emptySubscribe = () => () => {};

interface AuthState {
  loading: boolean;
  authenticated: boolean;
  previewMode: boolean;
  setupCompleted: boolean;
  needsMfaEnroll: boolean;
  user: SafeUser | null;
  csrfToken: string | null;
  facility: FacilityRecord | null;
  themeKey: ThemeKey;
  colorMode: ColorMode;
  refreshAuth: () => Promise<void>;
  setCareTheme: (themeKey: ThemeKey, colorMode?: ColorMode, persistToServer?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function CareMedsInnerProvider({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [setupCompleted, setSetupCompleted] = useState(true);
  const [needsMfaEnroll, setNeedsMfaEnroll] = useState(false);
  const [user, setUser] = useState<SafeUser | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [facility, setFacility] = useState<FacilityRecord | null>(null);
  const [themeKey, setThemeKey] = useState<ThemeKey>('clinical-calm');
  const [colorMode, setColorMode] = useState<ColorMode>('system');

  const applyThemeToDom = useCallback(
    (nextTheme: ThemeKey, nextMode: ColorMode) => {
      setThemeKey(nextTheme);
      setColorMode(nextMode);
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', nextTheme);
      }
      setTheme(nextMode);
    },
    [setTheme]
  );

  const hydrateFromAuthPayload = useCallback(
    (data: Record<string, unknown>) => {
      setPreviewMode(Boolean(data.previewMode));
      if (data.authenticated) {
        setAuthenticated(true);
        setSetupCompleted(true);
        setUser((data.user as SafeUser) || null);
        setCsrfToken((data.csrfToken as string) || null);
        setNeedsMfaEnroll(Boolean(data.needsMfaEnroll));
        setFacility((data.facility as FacilityRecord) || null);
        const prefs = (data.preferences as { themeKey?: string; colorMode?: string } | undefined) || {};
        const tk = isValidThemeKey(prefs.themeKey || '') ? (prefs.themeKey as ThemeKey) : 'clinical-calm';
        const cm = isValidColorMode(prefs.colorMode || '') ? (prefs.colorMode as ColorMode) : 'system';
        applyThemeToDom(tk, cm);
      } else {
        setAuthenticated(false);
        setUser(null);
        setCsrfToken(null);
        setNeedsMfaEnroll(false);
        setSetupCompleted(Boolean(data.setupCompleted));
        const defTk = String(data.defaultTheme || '');
        const defCm = String(data.defaultColorMode || '');
        const tk = isValidThemeKey(defTk) ? defTk : 'clinical-calm';
        const cm = isValidColorMode(defCm) ? defCm : 'system';
        applyThemeToDom(tk, cm);
      }
    },
    [applyThemeToDom]
  );

  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json();
      hydrateFromAuthPayload(data);
    } catch {
      setAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [hydrateFromAuthPayload]);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (active) hydrateFromAuthPayload(data);
      })
      .catch(() => {
        if (active) {
          setAuthenticated(false);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [hydrateFromAuthPayload]);

  const setCareTheme = useCallback(
    async (nextTheme: ThemeKey, nextMode?: ColorMode, persistToServer = true) => {
      const resolvedMode = nextMode ?? colorMode;
      applyThemeToDom(nextTheme, resolvedMode);
      if (persistToServer && authenticated) {
        await fetch('/api/profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
          },
          body: JSON.stringify({ themeKey: nextTheme, colorMode: resolvedMode }),
        }).catch(() => {});
      }
    },
    [applyThemeToDom, authenticated, colorMode, csrfToken]
  );

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthenticated(false);
    setUser(null);
    setCsrfToken(null);
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider
      value={{
        loading,
        authenticated,
        previewMode,
        setupCompleted,
        needsMfaEnroll,
        user,
        csrfToken,
        facility,
        themeKey,
        colorMode,
        refreshAuth,
        setCareTheme,
        logout,
      }}
    >
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
      {mounted ? <Toaster position="bottom-right" richColors closeButton /> : null}
    </AuthContext.Provider>
  );
}

export function CareMedsProviders({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <CareMedsInnerProvider>{children}</CareMedsInnerProvider>
    </NextThemesProvider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside CareMedsProviders');
  return ctx;
}
