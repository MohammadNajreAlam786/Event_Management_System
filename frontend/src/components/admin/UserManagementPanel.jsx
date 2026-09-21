import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import useAuthStore from '../../store/useAuthStore.js';
import StatusBadge from './StatusBadge.jsx';
import EmptyState from '../EmptyState.jsx';
import ConfirmDialog from '../ConfirmDialog.jsx';
import ErrorBanner from '../ui/ErrorBanner.jsx';
import PageHeader from '../ui/PageHeader.jsx';
import Icon from '../ui/Icon.jsx';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 400;

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * Shared account-management UI: search + filters + paginated table +
 * activate/deactivate. Used by both the Users page (all roles, role filter
 * shown) and the Organisers page (fixed to ORGANISER, role filter hidden) —
 * one implementation, one set of backend calls, no duplicated logic.
 *
 * @param {{
 *   title: string,
 *   description: string,
 *   fetchAccounts: (params) => Promise<{ users, pagination }>,
 *   updateStatus: (id, status) => Promise<{ message }>,
 *   showRoleFilter?: boolean,
 * }} props
 */
const UserManagementPanel = ({ title, description, fetchAccounts, updateStatus, showRoleFilter = false }) => {
  const navigate = useNavigate();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, totalUsers: 0, totalPages: 1 });
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const retry = () => setReloadKey((k) => k + 1);

  const [confirm, setConfirm] = useState(null); // { id, name } | null
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  // Debounce the free-text search box.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setLoadState('loading');
    setError('');

    fetchAccounts({ search: search || undefined, role: role || undefined, status: status || undefined, page, limit: PAGE_SIZE })
      .then((data) => {
        if (!active) return;
        setUsers(data.users);
        setPagination(data.pagination);
        setLoadState('ready');
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setError(err.message || 'Failed to load accounts.');
        setLoadState('error');
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, role, status, page, reloadKey]);

  const applyLocalStatus = (id, nextStatus) =>
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: nextStatus } : u)));

  const handleActivate = async (user) => {
    setBusyId(user.id);
    setActionError('');
    try {
      await updateStatus(user.id, 'ACTIVE');
      applyLocalStatus(user.id, 'ACTIVE');
    } catch (err) {
      setActionError(err.message || 'Failed to activate the account.');
    } finally {
      setBusyId(null);
    }
  };

  const requestDeactivate = (user) => setConfirm(user);

  const confirmDeactivate = async () => {
    if (!confirm) return;
    setBusyId(confirm.id);
    setActionError('');
    try {
      await updateStatus(confirm.id, 'INACTIVE');
      applyLocalStatus(confirm.id, 'INACTIVE');
      setConfirm(null);
    } catch (err) {
      setActionError(err.message || 'Failed to deactivate the account.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-5">
      <PageHeader title={title} description={description} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {showRoleFilter && (
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All roles</option>
            <option value="ADMIN">Admin</option>
            <option value="ORGANISER">Organiser</option>
            <option value="USER">User</option>
          </select>
        )}

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {actionError && <ErrorBanner message={actionError} />}

      {loadState === 'error' && <ErrorBanner message={error} onRetry={retry} />}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              {showRoleFilter && <th className="px-4 py-3 font-medium">Role</th>}
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loadState === 'loading' &&
              Array.from({ length: 5 }).map((_, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <tr key={i}>
                  <td className="px-4 py-3" colSpan={showRoleFilter ? 6 : 5}>
                    <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                  </td>
                </tr>
              ))}

            {loadState === 'ready' &&
              users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {u.name} {isSelf && <span className="text-xs font-normal text-slate-400">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    {showRoleFilter && <td className="px-4 py-3 text-slate-600">{u.role}</td>}
                    <td className="px-4 py-3">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {u.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          disabled={isSelf || busyId === u.id}
                          onClick={() => requestDeactivate(u)}
                          title={isSelf ? 'You cannot deactivate your own account.' : undefined}
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === u.id}
                          onClick={() => handleActivate(u)}
                          className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busyId === u.id ? 'Working…' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        {loadState === 'ready' && users.length === 0 && (
          <div className="p-4">
            <EmptyState title="No accounts match your filters" description="Try a different search term or clear the filters." icon="users" />
          </div>
        )}
      </div>

      {loadState === 'ready' && pagination.totalUsers > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <span>
            Page {pagination.page} of {pagination.totalPages} · {pagination.totalUsers} total
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title="Deactivate account"
          message={`Are you sure you want to deactivate ${confirm.name} (${confirm.email})? They will no longer be able to log in.`}
          confirmLabel="Deactivate"
          busy={busyId === confirm.id}
          onCancel={() => setConfirm(null)}
          onConfirm={confirmDeactivate}
        />
      )}
    </section>
  );
};

export default UserManagementPanel;
