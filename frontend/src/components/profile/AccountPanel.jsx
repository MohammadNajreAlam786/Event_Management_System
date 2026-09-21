import { useState } from 'react';

import useAuthStore from '../../store/useAuthStore.js';
import { roleLabel } from '../../utils/roles.js';
import { formatDateTime } from '../../utils/eventMeta.js';
import Icon from '../ui/Icon.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';
import ErrorBanner from '../ui/ErrorBanner.jsx';
import SuccessBanner from '../ui/SuccessBanner.jsx';

const ROLE_TONE = { ADMIN: 'violet', ORGANISER: 'indigo', USER: 'emerald' };

const initialsOf = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';

const fieldClass = (hasError) =>
  `w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 ${
    hasError
      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
      : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
  }`;

const FieldError = ({ message }) =>
  message ? (
    <p className="flex items-center gap-1 text-xs text-rose-600">
      <Icon name="alert-circle" className="h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  ) : null;

/** Only `name` exists on the User model beyond the read-only fields — phone/department/institution/avatar are not implemented (not supported by the schema). */
const EditProfileForm = ({ user, onDone }) => {
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [name, setName] = useState(user.name);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    const trimmed = name.trim();
    const nextErrors = {};
    if (!trimmed) nextErrors.name = 'Name is required.';
    else if (trimmed.length < 2 || trimmed.length > 100) nextErrors.name = 'Name must be between 2 and 100 characters.';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await updateProfile({ name: trimmed });
      onDone(true);
    } catch (err) {
      if (err.fieldErrors) setErrors(err.fieldErrors);
      setFormError(err.message || 'Could not update your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      {formError && <ErrorBanner message={formError} />}
      <div className="space-y-1">
        <label htmlFor="profile-name" className="block text-sm font-medium text-slate-700">
          Full name
        </label>
        <input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={fieldClass(errors.name)}
        />
        <FieldError message={errors.name} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => onDone(false)} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
};

const PASSWORD_FIELDS = [
  { key: 'currentPassword', label: 'Current password', autoComplete: 'current-password' },
  { key: 'newPassword', label: 'New password', autoComplete: 'new-password' },
  { key: 'confirmNewPassword', label: 'Confirm new password', autoComplete: 'new-password' },
];

const ChangePasswordForm = ({ onDone }) => {
  const changePassword = useAuthStore((s) => s.changePassword);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');

    const nextErrors = {};
    if (!form.currentPassword) nextErrors.currentPassword = 'Current password is required.';
    if (!form.newPassword) {
      nextErrors.newPassword = 'New password is required.';
    } else if (form.newPassword.length < 8 || !/[A-Za-z]/.test(form.newPassword) || !/\d/.test(form.newPassword)) {
      nextErrors.newPassword = 'Password must be at least 8 characters and include at least one letter and one number.';
    } else if (form.currentPassword && form.newPassword === form.currentPassword) {
      nextErrors.newPassword = 'New password must be different from your current password.';
    }
    if (!form.confirmNewPassword) nextErrors.confirmNewPassword = 'Please confirm your new password.';
    else if (form.confirmNewPassword !== form.newPassword) nextErrors.confirmNewPassword = 'Passwords do not match.';

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await changePassword(form);
      onDone(true);
    } catch (err) {
      if (err.fieldErrors) setErrors(err.fieldErrors);
      setFormError(err.message || 'Could not update your password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      {formError && <ErrorBanner message={formError} />}
      {PASSWORD_FIELDS.map(({ key, label, autoComplete }) => (
        <div key={key} className="space-y-1">
          <label htmlFor={key} className="block text-sm font-medium text-slate-700">
            {label}
          </label>
          <input
            id={key}
            type="password"
            autoComplete={autoComplete}
            value={form[key]}
            onChange={update(key)}
            className={fieldClass(errors[key])}
          />
          <FieldError message={errors[key]} />
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Saving…' : 'Change password'}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => onDone(false)} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
};

/**
 * Shared account block — avatar/name/email/role/status, read-only account
 * metadata, and toggleable Edit Profile / Change Password forms. Reused
 * as-is on both the Profile page (as the main content) and every role's
 * Settings page (alongside that role's own shortcuts), so the actual
 * edit/change-password logic exists in exactly one place.
 */
const AccountPanel = () => {
  const user = useAuthStore((s) => s.user);
  const [mode, setMode] = useState('view'); // view | edit | password
  const [success, setSuccess] = useState('');

  if (!user) return null;

  const toggle = (next) => {
    setSuccess('');
    setMode((current) => (current === next ? 'view' : next));
  };

  const handleDone = (label) => (saved) => {
    setMode('view');
    if (saved) setSuccess(label);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-lg font-semibold text-white">
            {initialsOf(user.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-slate-900">{user.name}</p>
            <p className="truncate text-sm text-slate-500">{user.email}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge tone={ROLE_TONE[user.role] ?? 'slate'}>{roleLabel(user.role)}</Badge>
              <Badge tone={user.status === 'ACTIVE' ? 'emerald' : 'rose'} dot>
                {user.status === 'ACTIVE' ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" onClick={() => toggle('edit')}>
            Edit Profile
          </Button>
          <Button size="sm" variant="secondary" onClick={() => toggle('password')}>
            Change Password
          </Button>
        </div>
      </div>

      {success && mode === 'view' && (
        <div className="mt-4">
          <SuccessBanner message={success} />
        </div>
      )}

      {mode === 'edit' && <EditProfileForm user={user} onDone={handleDone('Profile updated.')} />}
      {mode === 'password' && <ChangePasswordForm onDone={handleDone('Password updated.')} />}

      <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-slate-400">User ID</dt>
          <dd className="mt-0.5 truncate text-slate-700" title={user.id}>
            {user.id}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Account created</dt>
          <dd className="mt-0.5 text-slate-700">{formatDateTime(user.createdAt)}</dd>
        </div>
        {user.updatedAt && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Last updated</dt>
            <dd className="mt-0.5 text-slate-700">{formatDateTime(user.updatedAt)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
};

export default AccountPanel;
