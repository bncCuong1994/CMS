import { hasPermission } from '@cms/shared-types';
import { LogOut } from 'lucide-react';
import { NavLink, Navigate, Outlet } from 'react-router';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/features/auth/auth-store';
import { api } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './nav';

export function AppLayout() {
  const { user, accessToken, refreshToken, clear } = useAuthStore();
  if (!accessToken || !user) return <Navigate to="/login" replace />;

  const items = NAV_ITEMS.filter((i) => !i.permission || hasPermission(user.grants, i.permission));
  const roleText = user.roles
    .map((r) => (r.departmentName ? `${ROLE_LABELS[r.role]} · ${r.departmentName}` : ROLE_LABELS[r.role]))
    .join(', ');

  async function logout() {
    if (refreshToken) await api('/auth/logout', { method: 'POST', json: { refreshToken } }).catch(() => {});
    clear();
  }

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="px-6 py-5 text-lg font-semibold">CMS</div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  isActive && 'bg-accent font-medium text-accent-foreground',
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-4">
          <div className="truncate text-sm font-medium">{user.fullName}</div>
          <div className="mb-3 truncate text-xs text-muted-foreground">{roleText}</div>
          <Button variant="outline" size="sm" className="w-full" onClick={logout}>
            <LogOut />
            Đăng xuất
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
