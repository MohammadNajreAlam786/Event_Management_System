import { Link, useNavigate } from 'react-router-dom';

import useAuthStore from '../store/useAuthStore.js';
import { roleHomePath } from '../utils/roles.js';
import AccountPanel from '../components/profile/AccountPanel.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Icon from '../components/ui/Icon.jsx';

/**
 * /admin/profile, /organiser/profile, /user/profile — the same page for
 * every role, since the content (avatar, name, email, role, status, account
 * dates, Edit Profile, Change Password) is identical; only the "back to
 * dashboard" destination differs, derived from the signed-in user's own role.
 */
const ProfilePage = () => {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const dashboardHref = roleHomePath(user?.role);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <section className="mx-auto w-full max-w-3xl space-y-5">
      <PageHeader
        title="Profile"
        description="View and manage your account details."
        actions={
          <>
            <Link
              to={dashboardHref}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              Back to Dashboard
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              <Icon name="log-out" className="h-4 w-4" />
              Logout
            </button>
          </>
        }
      />
      <AccountPanel />
    </section>
  );
};

export default ProfilePage;
