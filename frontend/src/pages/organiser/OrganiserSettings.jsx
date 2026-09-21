import AccountPanel from '../../components/profile/AccountPanel.jsx';
import SettingsShortcuts from '../../components/profile/SettingsShortcuts.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';

const SHORTCUTS = [
  { to: '/organiser/events', label: 'My Events', description: 'Manage your events', icon: 'calendar' },
  { to: '/organiser/events/create', label: 'Create Event', description: 'Start planning a new event', icon: 'calendar-plus' },
  { to: '/organiser/analytics', label: 'Analytics', description: 'Post-event performance', icon: 'chart-bar' },
  { to: '/organiser/improvements', label: 'Improvements', description: 'AI-based recommendations', icon: 'sparkles' },
];

/** /organiser/settings — account management + organiser workspace shortcuts. */
const OrganiserSettings = () => (
  <section className="space-y-5">
    <PageHeader title="Settings" description="Manage your account and jump to your event tools." />

    <AccountPanel />

    <div>
      <SectionHeader icon="settings" title="Workspace shortcuts" />
      <div className="mt-3">
        <SettingsShortcuts items={SHORTCUTS} />
      </div>
    </div>
  </section>
);

export default OrganiserSettings;
