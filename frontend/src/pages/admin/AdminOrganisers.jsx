import UserManagementPanel from '../../components/admin/UserManagementPanel.jsx';
import adminService from '../../services/adminService.js';

/**
 * Organiser accounts only. Same secure backend mechanism as AdminUsers
 * (the /admin/organisers API is pre-scoped to role: ORGANISER), so the role
 * column/filter is hidden here — no duplicated table or fetch logic.
 */
const AdminOrganisers = () => (
  <UserManagementPanel
    title="Organisers"
    description="Organiser accounts. Search, filter by status, and activate or deactivate as needed."
    fetchAccounts={adminService.getOrganisers}
    updateStatus={adminService.updateOrganiserStatus}
    showRoleFilter={false}
  />
);

export default AdminOrganisers;
