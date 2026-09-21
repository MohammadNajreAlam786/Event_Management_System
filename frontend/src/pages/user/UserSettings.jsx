import AccountPanel from '../../components/profile/AccountPanel.jsx';
import SettingsShortcuts from '../../components/profile/SettingsShortcuts.jsx';
import SectionHeader from '../../components/ui/SectionHeader.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';

const SHORTCUTS = [
  { to: '/user/events', label: 'Discover Events', description: 'Find events to register for', icon: 'search' },
  { to: '/user/my-events', label: 'My Events', description: 'Your registrations and attendance', icon: 'calendar-check' },
  { to: '/user/certificates', label: 'Certificates', description: 'View and download your certificates', icon: 'award' },
  { to: '/user/feedback', label: 'Feedback', description: 'Share feedback on events you attended', icon: 'message-square' },
];

/** /user/settings — account management + participant shortcuts. */
const UserSettings = () => (
  <section className="space-y-5">
    <PageHeader title="Settings" description="Manage your account and jump to your participant tools." />

    <AccountPanel />

    <div>
      <SectionHeader icon="settings" title="Shortcuts" />
      <div className="mt-3">
        <SettingsShortcuts items={SHORTCUTS} />
      </div>
    </div>
  </section>
);

export default UserSettings;
