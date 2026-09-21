import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import DashboardSidebar from '../components/dashboard/DashboardSidebar.jsx';
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx';

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', end: true, icon: 'dashboard' },
  { to: '/admin/users', label: 'Users', icon: 'users' },
  { to: '/admin/organisers', label: 'Organisers', icon: 'building' },
  { to: '/admin/events', label: 'Events', icon: 'calendar' },
  { to: '/admin/statistics', label: 'Statistics', icon: 'chart-bar' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
];

const PAGE_TITLES = {
  '/admin': 'Dashboard',
  '/admin/users': 'Users',
  '/admin/organisers': 'Organisers',
  '/admin/events': 'Events',
  '/admin/statistics': 'Statistics',
  '/admin/settings': 'Settings',
  '/admin/profile': 'Profile',
};

/**
 * Shell for the whole /admin/* section: fixed sidebar (drawer on mobile) +
 * its own header, with the matched page rendered via <Outlet/>.
 * RoleProtectedRoute (roles=['ADMIN']) wraps this layout in AppRoutes.
 */
const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] ?? 'Admin';

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <DashboardSidebar
        brand="Admin"
        roleLabel="Admin"
        items={NAV_ITEMS}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardHeader title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-x-hidden p-4 md:p-6">
          <div className="mx-auto w-full max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
