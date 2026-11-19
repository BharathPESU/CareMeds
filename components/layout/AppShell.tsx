'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Drawer } from 'vaul';
import {
  Activity,
  AlertTriangle,
  Bell,
  Boxes,
  ClipboardCheck,
  FileBarChart2,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareHeart,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pill,
  Settings,
  ShieldCheck,
  Sun,
  UserCog,
  Users,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/components/providers/CareMedsProviders';
import type { RoleName } from '@/lib/types';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: RoleName[];
  section: 'care' | 'clinical' | 'admin';
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Doctor', 'Caretaker'], section: 'care' },
  { href: '/rounds', label: 'Med Rounds', icon: ClipboardCheck, roles: ['Admin', 'Doctor', 'Caretaker'], section: 'care' },
  { href: '/residents', label: 'Residents', icon: Users, roles: ['Admin', 'Doctor', 'Caretaker'], section: 'care' },
  { href: '/alerts', label: 'Alerts', icon: Bell, roles: ['Admin', 'Doctor', 'Caretaker'], section: 'care' },
  { href: '/emergency', label: 'Emergency', icon: AlertTriangle, roles: ['Admin', 'Doctor', 'Caretaker'], section: 'care' },
  { href: '/prescriptions', label: 'Prescriptions', icon: FileText, roles: ['Admin', 'Doctor', 'Caretaker'], section: 'clinical' },
  { href: '/medicines', label: 'Medicines', icon: Pill, roles: ['Admin', 'Doctor', 'Caretaker'], section: 'clinical' },
  { href: '/inventory', label: 'Inventory', icon: Boxes, roles: ['Admin', 'Doctor', 'Caretaker'], section: 'clinical' },
  { href: '/vitals', label: 'Vitals', icon: Activity, roles: ['Admin', 'Doctor', 'Caretaker'], section: 'clinical' },
  { href: '/reports', label: 'Reports', icon: FileBarChart2, roles: ['Admin', 'Doctor', 'Caretaker'], section: 'clinical' },
  { href: '/assistant', label: 'Care Assistant', icon: MessageSquareHeart, roles: ['Admin', 'Doctor', 'Caretaker'], section: 'clinical' },
  { href: '/admin/users', label: 'Staff & Access', icon: UserCog, roles: ['Admin'], section: 'admin' },
  { href: '/admin/settings', label: 'Facility Settings', icon: Settings, roles: ['Admin', 'Doctor'], section: 'admin' },
  { href: '/admin/audit', label: 'Audit Log', icon: ShieldCheck, roles: ['Admin'], section: 'admin' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { user, facility, loading, authenticated, needsMfaEnroll, themeKey, setCareTheme, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tabletExpanded, setTabletExpanded] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const visibleNav = useMemo(() => {
    if (!user) return [];
    return NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  }, [user]);

  const primaryBottomItems = useMemo(
    () => visibleNav.filter((i) => ['/dashboard', '/rounds', '/residents', '/alerts'].includes(i.href)),
    [visibleNav]
  );

  const moreBottomItems = useMemo(
    () => visibleNav.filter((i) => !['/dashboard', '/rounds', '/residents', '/alerts'].includes(i.href)),
    [visibleNav]
  );

  React.useEffect(() => {
    if (loading) return;
    if (!authenticated) {
      router.replace('/login');
      return;
    }
    if (user?.mustChangePassword) {
      router.replace('/change-password');
      return;
    }
    if (needsMfaEnroll) {
      router.replace('/mfa-enroll');
    }
  }, [loading, authenticated, user, needsMfaEnroll, router]);

  if (loading || !authenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--cm-bg)] text-[var(--cm-muted)]">
        <div className="flex flex-col items-center gap-3">
          <HeartPulse className="h-8 w-8 text-[var(--cm-primary)] animate-pulse" />
          <p className="text-[15px]">Loading CareMeds workspace…</p>
        </div>
      </div>
    );
  }

  const isActivePath = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));

  const toggleLightDark = () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    void setCareTheme(themeKey, next, true);
  };

  return (
    <div className="min-h-screen flex bg-[var(--cm-bg)] text-[var(--cm-text)]">
      {/* Desktop (>=1024px) Sidebar (256px collapsible to 72px) & Tablet (768-1023px) Icon Rail (72px expandable) */}
      <aside
        aria-label="Primary navigation"
        className={cn(
          'no-print hidden md:flex flex-col shrink-0 border-r border-[var(--cm-border)] bg-[var(--cm-surface)] transition-[width] duration-200 sticky top-0 h-screen z-30',
          sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-[256px]',
          tabletExpanded ? 'md:w-[240px]' : 'md:w-[72px]'
        )}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--cm-border)]">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 text-[18px] font-bold tracking-tight text-[var(--cm-text)] whitespace-nowrap overflow-hidden"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--cm-primary)] text-[var(--cm-primary-fg)]">
              <HeartPulse className="h-5 w-5" aria-hidden="true" />
            </span>
            <span
              className={cn(
                'truncate',
                tabletExpanded ? 'md:inline' : 'md:hidden',
                sidebarCollapsed ? 'lg:hidden' : 'lg:inline'
              )}
            >
              CareMeds
            </span>
          </Link>

          <button
            type="button"
            onClick={() => {
              setSidebarCollapsed((prev) => !prev);
              setTabletExpanded((prev) => !prev);
            }}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-[12px] text-[var(--cm-muted)] hover:bg-[var(--cm-surface-subtle)] hover:text-[var(--cm-text)] shrink-0"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-3 min-h-[44px] px-3 rounded-[12px] text-[15px] font-medium transition-colors whitespace-nowrap',
                  active
                    ? 'bg-[var(--cm-primary-tint)] text-[var(--cm-primary)]'
                    : 'text-[var(--cm-muted)] hover:bg-[var(--cm-surface-subtle)] hover:text-[var(--cm-text)]'
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[var(--cm-primary)]"
                  />
                )}
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span
                  className={cn(
                    'truncate',
                    tabletExpanded ? 'md:inline' : 'md:hidden',
                    sidebarCollapsed ? 'lg:hidden' : 'lg:inline'
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-[var(--cm-border)] space-y-1">
          <Link
            href="/profile"
            className={cn(
              'flex items-center gap-3 min-h-[44px] px-3 rounded-[12px] text-[14px] transition-colors',
              isActivePath('/profile')
                ? 'bg-[var(--cm-primary-tint)] text-[var(--cm-primary)] font-medium'
                : 'text-[var(--cm-muted)] hover:bg-[var(--cm-surface-subtle)] hover:text-[var(--cm-text)]'
            )}
          >
            <span className="h-8 w-8 rounded-full bg-[var(--cm-primary-tint)] text-[var(--cm-primary)] inline-flex items-center justify-center font-semibold shrink-0">
              {user.fullName
                .split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </span>
            <div
              className={cn(
                'min-w-0',
                tabletExpanded ? 'md:block' : 'md:hidden',
                sidebarCollapsed ? 'lg:hidden' : 'lg:block'
              )}
            >
              <div className="text-[14px] font-medium text-[var(--cm-text)] truncate">
                {user.fullName}
              </div>
              <div className="text-[12px] text-[var(--cm-muted)] truncate">{user.role}</div>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => void logout()}
            className="w-full flex items-center gap-3 min-h-[44px] px-3 rounded-[12px] text-[14px] font-medium text-[var(--cm-muted)] hover:bg-[var(--cm-danger-bg)] hover:text-[var(--cm-danger)] transition-colors cursor-pointer"
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span
              className={cn(
                tabletExpanded ? 'md:inline' : 'md:hidden',
                sidebarCollapsed ? 'lg:hidden' : 'lg:inline'
              )}
            >
              Sign out
            </span>
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="no-print sticky top-0 z-20 h-16 border-b border-[var(--cm-border)] bg-[var(--cm-surface)] px-4 md:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard"
              className="md:hidden inline-flex items-center gap-2 font-bold text-[17px] text-[var(--cm-text)] whitespace-nowrap"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--cm-primary)] text-[var(--cm-primary-fg)]">
                <HeartPulse className="h-4 w-4" />
              </span>
              CareMeds
            </Link>
            <div className="hidden md:flex items-center gap-2 text-[14px] text-[var(--cm-muted)] truncate">
              <span className="font-semibold text-[var(--cm-text)] truncate">
                {facility?.name || 'CareMeds Facility'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap">{user.role} workspace</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/emergency"
              className="inline-flex items-center gap-2 min-h-[44px] px-3.5 rounded-[12px] bg-[#B91C1C] text-white text-[14px] font-medium hover:bg-[#991B1B] transition-colors whitespace-nowrap shrink-0"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Emergency</span>
            </Link>

            <button
              type="button"
              onClick={toggleLightDark}
              aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-[12px] border border-[var(--cm-border)] text-[var(--cm-text)] hover:bg-[var(--cm-surface-subtle)] cursor-pointer"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 px-4 py-5 md:px-6 lg:px-8 pb-24 md:pb-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile (<768px) Bottom Navigation Bar with Vaul More Sheet */}
      <nav
        aria-label="Mobile navigation"
        className="no-print md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[var(--cm-border)] bg-[var(--cm-surface)] safe-bottom"
      >
        <div className="grid grid-cols-5 h-[60px]">
          {primaryBottomItems.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 text-[12px] font-medium min-h-[44px]',
                  active ? 'text-[var(--cm-primary)]' : 'text-[var(--cm-muted)]'
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 inset-x-3 h-[3px] rounded-b-full bg-[var(--cm-primary)]"
                  />
                )}
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="truncate max-w-full px-1">{item.label.replace('Med ', '')}</span>
              </Link>
            );
          })}

          <Drawer.Root open={moreOpen} onOpenChange={setMoreOpen}>
            <Drawer.Trigger asChild>
              <button
                type="button"
                aria-label="More navigation options"
                className="flex flex-col items-center justify-center gap-0.5 text-[12px] font-medium text-[var(--cm-muted)] min-h-[44px]"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
                <span>More</span>
              </button>
            </Drawer.Trigger>
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 z-50 bg-slate-950/50" />
              <Drawer.Content className="fixed bottom-0 inset-x-0 z-50 rounded-t-[24px] bg-[var(--cm-surface)] border-t border-[var(--cm-border)] p-5 safe-bottom max-h-[82vh] overflow-y-auto">
                <div className="mx-auto w-12 h-1.5 rounded-full bg-[var(--cm-border)] mb-4" />
                <Drawer.Title className="text-[18px] font-semibold text-[var(--cm-text)] mb-3">
                  More CareMeds Modules
                </Drawer.Title>
                <div className="grid grid-cols-2 gap-2.5">
                  {moreBottomItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActivePath(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          'flex items-center gap-2.5 min-h-[48px] px-3.5 rounded-[12px] border text-[14px] font-medium',
                          active
                            ? 'bg-[var(--cm-primary-tint)] border-[var(--cm-primary)] text-[var(--cm-primary)]'
                            : 'border-[var(--cm-border)] text-[var(--cm-text)]'
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                  <Link
                    href="/profile"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2.5 min-h-[48px] px-3.5 rounded-[12px] border border-[var(--cm-border)] text-[14px] font-medium text-[var(--cm-text)]"
                  >
                    <UserCog className="h-5 w-5 shrink-0" />
                    <span>Profile & Theme</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      void logout();
                    }}
                    className="flex items-center gap-2.5 min-h-[48px] px-3.5 rounded-[12px] border border-[var(--cm-border)] text-[14px] font-medium text-[var(--cm-danger)]"
                  >
                    <LogOut className="h-5 w-5 shrink-0" />
                    <span>Sign out</span>
                  </button>
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>
        </div>
      </nav>
    </div>
  );
}
