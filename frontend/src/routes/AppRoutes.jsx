import { Routes, Route } from 'react-router-dom';

import RootLayout from '../layouts/RootLayout.jsx';
import AdminLayout from '../layouts/AdminLayout.jsx';
import OrganiserLayout from '../layouts/OrganiserLayout.jsx';
import UserLayout from '../layouts/UserLayout.jsx';
import PlanningWorkspaceLayout from '../layouts/PlanningWorkspaceLayout.jsx';
import HomePage from '../pages/HomePage.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import RegisterPage from '../pages/RegisterPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import CertificateVerify from '../pages/CertificateVerify.jsx';
import AdminDashboard from '../pages/admin/AdminDashboard.jsx';
import AdminUsers from '../pages/admin/AdminUsers.jsx';
import AdminOrganisers from '../pages/admin/AdminOrganisers.jsx';
import AdminEvents from '../pages/admin/AdminEvents.jsx';
import AdminStatistics from '../pages/admin/AdminStatistics.jsx';
import AdminSettings from '../pages/admin/AdminSettings.jsx';
import ProfilePage from '../pages/ProfilePage.jsx';
import OrganiserSettings from '../pages/organiser/OrganiserSettings.jsx';
import UserSettings from '../pages/user/UserSettings.jsx';
import OrganiserDashboard from '../pages/organiser/OrganiserDashboard.jsx';
import OrganiserEvents from '../pages/organiser/OrganiserEvents.jsx';
import OrganiserEventCreate from '../pages/organiser/OrganiserEventCreate.jsx';
import OrganiserEventEdit from '../pages/organiser/OrganiserEventEdit.jsx';
import OrganiserEventDetails from '../pages/organiser/OrganiserEventDetails.jsx';
import OrganiserEventParticipants from '../pages/organiser/OrganiserEventParticipants.jsx';
import OrganiserEventAttendance from '../pages/organiser/OrganiserEventAttendance.jsx';
import UserDashboard from '../pages/user/UserDashboard.jsx';
import BrowseEvents from '../pages/user/BrowseEvents.jsx';
import EventDetailsPublic from '../pages/user/EventDetailsPublic.jsx';
import MyEvents from '../pages/user/MyEvents.jsx';
import EventQr from '../pages/user/EventQr.jsx';
import UserNotifications from '../pages/user/UserNotifications.jsx';
import UserCertificates from '../pages/user/UserCertificates.jsx';
import UserFeedback from '../pages/user/UserFeedback.jsx';
import FeedbackForm from '../pages/user/FeedbackForm.jsx';
import OrganiserEventCertificates from '../pages/organiser/OrganiserEventCertificates.jsx';
import OrganiserEventFeedback from '../pages/organiser/OrganiserEventFeedback.jsx';
import OrganiserAnalytics from '../pages/organiser/OrganiserAnalytics.jsx';
import OrganiserImprovements from '../pages/organiser/OrganiserImprovements.jsx';
import PlanningOverview from '../pages/organiser/planning/PlanningOverview.jsx';
import PlanningTasks from '../pages/organiser/planning/PlanningTasks.jsx';
import PlanningSchedule from '../pages/organiser/planning/PlanningSchedule.jsx';
import PlanningResources from '../pages/organiser/planning/PlanningResources.jsx';
import PlanningBudget from '../pages/organiser/planning/PlanningBudget.jsx';
import PlanningTeam from '../pages/organiser/planning/PlanningTeam.jsx';
import PlanningReadiness from '../pages/organiser/planning/PlanningReadiness.jsx';
import PlanningAiAssistant from '../pages/organiser/planning/PlanningAiAssistant.jsx';
import RoleProtectedRoute from './RoleProtectedRoute.jsx';
import { ROLES } from '../utils/roles.js';

/**
 * Route table (Phase 4).
 *   /, /login, /register             public
 *   /user                            USER only  (under RootLayout)
 *   /organiser/*                     ORGANISER only — own layout
 *   /organiser/events/:id/planning/* ORGANISER only — planning workspace shell
 *   /admin/*                         ADMIN only — own layout
 *
 * Frontend guards are UX only; the backend enforces the same rules on its APIs.
 */
const AppRoutes = () => (
  <Routes>
    <Route element={<RootLayout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify" element={<CertificateVerify />} />
      <Route path="/verify/:code" element={<CertificateVerify />} />

      <Route path="*" element={<NotFoundPage />} />
    </Route>

    <Route
      path="/user"
      element={
        <RoleProtectedRoute roles={[ROLES.USER]}>
          <UserLayout />
        </RoleProtectedRoute>
      }
    >
      <Route index element={<UserDashboard />} />
      <Route path="events" element={<BrowseEvents />} />
      <Route path="events/:id" element={<EventDetailsPublic />} />
      <Route path="my-events" element={<MyEvents />} />
      <Route path="my-events/:registrationId/qr" element={<EventQr />} />
      <Route path="notifications" element={<UserNotifications />} />
      <Route path="certificates" element={<UserCertificates />} />
      <Route path="feedback" element={<UserFeedback />} />
      <Route path="feedback/:eventId" element={<FeedbackForm />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="settings" element={<UserSettings />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>

    <Route
      path="/organiser"
      element={
        <RoleProtectedRoute roles={[ROLES.ORGANISER]}>
          <OrganiserLayout />
        </RoleProtectedRoute>
      }
    >
      <Route index element={<OrganiserDashboard />} />
      <Route path="analytics" element={<OrganiserAnalytics />} />
      <Route path="improvements" element={<OrganiserImprovements />} />
      <Route path="events" element={<OrganiserEvents />} />
      <Route path="events/create" element={<OrganiserEventCreate />} />
      <Route path="events/:id" element={<OrganiserEventDetails />} />
      <Route path="events/:id/edit" element={<OrganiserEventEdit />} />
      <Route path="events/:id/participants" element={<OrganiserEventParticipants />} />
      <Route path="events/:id/attendance" element={<OrganiserEventAttendance />} />
      <Route path="events/:id/certificates" element={<OrganiserEventCertificates />} />
      <Route path="events/:id/feedback" element={<OrganiserEventFeedback />} />

      <Route path="events/:id/planning" element={<PlanningWorkspaceLayout />}>
        <Route index element={<PlanningOverview />} />
        <Route path="tasks" element={<PlanningTasks />} />
        <Route path="schedule" element={<PlanningSchedule />} />
        <Route path="resources" element={<PlanningResources />} />
        <Route path="budget" element={<PlanningBudget />} />
        <Route path="team" element={<PlanningTeam />} />
        <Route path="readiness" element={<PlanningReadiness />} />
        <Route path="ai" element={<PlanningAiAssistant />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="profile" element={<ProfilePage />} />
      <Route path="settings" element={<OrganiserSettings />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>

    <Route
      path="/admin"
      element={
        <RoleProtectedRoute roles={[ROLES.ADMIN]}>
          <AdminLayout />
        </RoleProtectedRoute>
      }
    >
      <Route index element={<AdminDashboard />} />
      <Route path="users" element={<AdminUsers />} />
      <Route path="organisers" element={<AdminOrganisers />} />
      <Route path="events" element={<AdminEvents />} />
      <Route path="statistics" element={<AdminStatistics />} />
      <Route path="settings" element={<AdminSettings />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>
);

export default AppRoutes;
