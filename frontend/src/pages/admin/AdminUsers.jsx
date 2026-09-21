import UserManagementPanel from '../../components/admin/UserManagementPanel.jsx';
import adminService from '../../services/adminService.js';

/**
 * All platform accounts (any role), searchable/filterable/paginated.
 * Thin wrapper around the shared UserManagementPanel — see AdminOrganisers
 * for the same panel scoped to organisers.
 */
const AdminUsers = () => (
  <UserManagementPanel
    title="Users"
    description="All registered accounts. Search, filter, and activate or deactivate as needed."
    fetchAccounts={adminService.getUsers}
    updateStatus={adminService.updateUserStatus}
    showRoleFilter
  />
);

export default AdminUsers;
