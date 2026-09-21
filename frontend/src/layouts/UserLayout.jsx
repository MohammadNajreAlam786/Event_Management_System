import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, matchPath } from 'react-router-dom';

import DashboardSidebar from '../components/dashboard/DashboardSidebar.jsx';
import DashboardHeader from '../components/dashboard/DashboardHeader.jsx';
import notificationService from '../services/notificationService.js';

const titleFor = (pathname) => {
  if (matchPath('/user', pathname)) return 'Dashboard';
  if (matchPath('/user/events/:id', pathname)) return 'Event Details';
  if (matchPath('/user/events', pathname)) return 'Browse Events';
  if (matchPath('/user/my-events/:registrationId/qr', pathname)) return 'Attendance QR';
  if (matchPath('/user/my-events', pathname)) return 'My Events';
  if (matchPath('/user/notifications', pathname)) return 'Notifications';
  if (matchPath('/user/certificates', pathname)) return 'Certificates';
  if (matchPath('/user/feedback/:eventId', pathname)) return 'Give Feedback';
  if (matchPath('/user/feedback', pathname)) return 'Feedback';
  if (matchPath('/user/settings', pathname)) return 'Settings';
  if (matchPath('/user/profile', pathname)) return 'Profile';
  return 'Participant';
};

/**
 * Shell for /user/*: shared dashboard sidebar (drawer on mobile) + header, with
 * the matched page via <Outlet/>. RoleProtectedRoute (roles=['USER']) wraps this
 * in AppRoutes. Participants only ever see participant navigation.
 *
 * The unread-notification count is fetched once on mount and again whenever a
 * child page reports a change via the outlet context `refreshUnread()` — no
 * polling (§47). It also drives the header's notification bell badge.
 */
const UserLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const location = useLocation();

  const refreshUnread = useCallback(() => {
    notificationService
      .unreadCount()
      .then(setUnread)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshUnread();
  }, [refreshUnread]);

  const navItems = [
    { to: '/user', label: 'Dashboard', end: true, icon: 'dashboard' },
    { to: '/user/events', label: 'Discover Events', end: true, icon: 'search' },
    { to: '/user/my-events', label: 'My Events', end: true, icon: 'calendar-check' },
    { to: '/user/notifications', label: 'Notifications', end: true, icon: 'bell', badge: unread },
    { to: '/user/certificates', label: 'Certificates', end: true, icon: 'award' },
    { to: '/user/feedback', label: 'Feedback', end: true, icon: 'message-square' },
    { to: '/user/settings', label: 'Settings', end: true, icon: 'settings' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <DashboardSidebar
        brand="Participant"
        roleLabel="Participant"
        items={navItems}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <DashboardHeader
          title={titleFor(location.pathname)}
          onMenuClick={() => setSidebarOpen(true)}
          notifyHref="/user/notifications"
          notifyCount={unread}
        />
        <main className="flex-1 overflow-x-hidden p-4 md:p-6">
          <div className="mx-auto w-full max-w-[1400px]">
            <Outlet context={{ refreshUnread }} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default UserLayout;
