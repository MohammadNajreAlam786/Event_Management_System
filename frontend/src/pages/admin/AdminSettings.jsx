import AccountPanel from '../../components/profile/AccountPanel.jsx';
import SettingsShortcuts from '../../components/profile/SettingsShortcuts.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import BackendStatus from '../../components/BackendStatus.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';

const SHORTCUTS = [
  { to: '/admin/users', label: 'Users', description: 'Manage participant and organiser accounts', icon: 'users' },
  { to: '/admin/organisers', label: 'Organisers', description: 'Review organiser accounts', icon: 'building' },
  { to: '/admin/events', label: 'Events', description: 'Platform-wide event oversight', icon: 'calendar' },
  { to: '/admin/statistics', label: 'Statistics', description: 'Platform analytics roll-up', icon: 'chart-bar' },
];

/** /admin/settings — account management + platform shortcuts. Replaces the old "Coming soon" placeholder. */
const AdminSettings = () => (
  <section className="space-y-5">
    <PageHeader title="Settings" description="Manage your account and jump to platform administration." />

    <AccountPanel />

    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <SectionHeader icon="info" title="Platform information" />
      <p className="mt-2 text-sm text-slate-600">
        AI-Powered Event Planning &amp; Management System — planning, registration, QR attendance,
        certificates, feedback, analytics and AI-based improvement recommendations in one place.
      </p>
      <div className="mt-3 max-w-xs">
        <BackendStatus />
      </div>
    </div>

    <div>
      <SectionHeader icon="settings" title="Platform shortcuts" />
      <div className="mt-3">
        <SettingsShortcuts items={SHORTCUTS} />
      </div>
    </div>
  </section>
);

export default AdminSettings;
