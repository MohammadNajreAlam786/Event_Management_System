import { useState } from 'react';
import { Outlet, useLocation, matchPath } from 'react-router-dom';

import DashboardSidebar from '../components/dashboard/DashboardSidebar.jsx';
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx';

const NAV_ITEMS = [
  { to: '/organiser', label: 'Dashboard', end: true, icon: 'dashboard' },
  { to: '/organiser/events', label: 'My Events', end: true, icon: 'calendar' },
  { to: '/organiser/events/create', label: 'Create Event', icon: 'calendar-plus' },
  { to: '/organiser/analytics', label: 'Analytics', icon: 'chart-bar' },
  { to: '/organiser/improvements', label: 'Improvements', icon: 'sparkles' },
  { to: '/organiser/settings', label: 'Settings', icon: 'settings' },
];

const titleFor = (pathname) => {
  if (matchPath('/organiser', pathname)) return 'Dashboard';
  if (matchPath('/organiser/analytics', pathname)) return 'Analytics';
  if (matchPath('/organiser/improvements', pathname)) return 'Improvements';
  if (matchPath('/organiser/settings', pathname)) return 'Settings';
  if (matchPath('/organiser/profile', pathname)) return 'Profile';
  if (matchPath('/organiser/events/create', pathname)) return 'Create Event';
  if (matchPath('/organiser/events/:id/edit', pathname)) return 'Edit Event';
  if (matchPath('/organiser/events/:id/participants', pathname)) return 'Participants';
  if (matchPath('/organiser/events/:id/attendance', pathname)) return 'Attendance';
  if (matchPath('/organiser/events/:id/certificates', pathname)) return 'Certificates';
  if (matchPath('/organiser/events/:id/feedback', pathname)) return 'Feedback';
  if (matchPath('/organiser/events/:id', pathname)) return 'Event Details';
  if (matchPath('/organiser/events', pathname)) return 'My Events';
  const last = pathname.split('/').filter(Boolean).pop() ?? 'organiser';
  if (last === 'ai') return 'AI Assistant';
  return last.charAt(0).toUpperCase() + last.slice(1);
};

/**
 * Shell for /organiser/*: fixed sidebar (drawer on mobile) + header, with the
 * matched page via <Outlet/>. RoleProtectedRoute (roles=['ORGANISER']) wraps
 * this layout in AppRoutes.
 */
const OrganiserLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <DashboardSidebar
        brand="Organiser"
        roleLabel="Organiser"
        items={NAV_ITEMS}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardHeader title={titleFor(location.pathname)} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-x-hidden p-4 md:p-6">
          <div className="mx-auto w-full max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default OrganiserLayout;
