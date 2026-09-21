import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import useAuthStore, { selectIsAuthenticated } from '../store/useAuthStore.js';
import { REGISTERABLE_ROLES, ROLES, roleHomePath } from '../utils/roles.js';
import Icon from '../components/ui/Icon.jsx';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;

const initialForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: ROLES.USER,
};

/** Client-side mirror of the backend password policy. */
const passwordProblem = (value) => {
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return 'Password must include at least one letter and one number.';
  }
  return '';
};

const validate = (form) => {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Name is required.';
  else if (form.name.trim().length < 2) errors.name = 'Name must be at least 2 characters.';

  if (!form.email.trim()) errors.email = 'Email is required.';
  else if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = 'Enter a valid email address.';

  const pwProblem = passwordProblem(form.password);
  if (!form.password) errors.password = 'Password is required.';
  else if (pwProblem) errors.password = pwProblem;

  if (!form.confirmPassword) errors.confirmPassword = 'Please confirm your password.';
  else if (form.confirmPassword !== form.password) errors.confirmPassword = 'Passwords do not match.';

  if (!REGISTERABLE_ROLES.some((r) => r.value === form.role)) {
    errors.role = 'Choose an account type.';
  }
  return errors;
};

const RegisterPage = () => {
  const navigate = useNavigate();

  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const register = useAuthStore((s) => s.register);
  const clearError = useAuthStore((s) => s.clearError);

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    clearError();
  }, [clearError]);

  if (isAuthenticated) {
    return <Navigate to={roleHomePath(user.role)} replace />;
  }

  const update = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    const nextErrors = validate(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        role: form.role,
      });
      navigate('/login', { replace: true, state: { registered: true } });
    } catch (err) {
      if (err.fieldErrors && typeof err.fieldErrors === 'object') {
        setErrors((prev) => ({ ...prev, ...err.fieldErrors }));
      }
      setFormError(err.message || 'Registration failed. Please try again.');
    }
  };

  const fieldClass = (field) =>
    `w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 ${
      errors[field]
        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
        : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
    }`;

  const FieldError = ({ name }) =>
    errors[name] ? (
      <p className="flex items-center gap-1 text-xs text-rose-600">
        <Icon name="alert-circle" className="h-3.5 w-3.5 shrink-0" />
        {errors[name]}
      </p>
    ) : null;

  return (
    <section className="mx-auto w-full max-w-sm space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
      <div className="space-y-1">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Icon name="user" className="h-5 w-5" />
        </span>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Create an account</h1>
        <p className="text-sm text-slate-500">Register as a participant or an organiser.</p>
      </div>

      {formError && (
        <p className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <Icon name="alert-circle" className="h-4 w-4 shrink-0" />
          {formError}
        </p>
      )}

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="space-y-1">
          <label htmlFor="name" className="block text-sm font-medium text-slate-700">
            Name
          </label>
          <input id="name" type="text" autoComplete="name" value={form.name}
            onChange={update('name')} className={fieldClass('name')} />
          <FieldError name="name" />
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input id="email" type="email" autoComplete="email" value={form.email}
            onChange={update('email')} className={fieldClass('email')} />
          <FieldError name="email" />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative">
            <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password}
              onChange={update('password')} className={`${fieldClass('password')} pr-9`} />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <Icon name={showPassword ? 'eye-off' : 'eye'} className="h-4 w-4" />
            </button>
          </div>
          <FieldError name="password" />
          <p className="text-xs text-slate-400">
            At least {PASSWORD_MIN_LENGTH} characters, with a letter and a number.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
            Confirm password
          </label>
          <div className="relative">
            <input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password"
              value={form.confirmPassword} onChange={update('confirmPassword')}
              className={`${fieldClass('confirmPassword')} pr-9`} />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              <Icon name={showConfirmPassword ? 'eye-off' : 'eye'} className="h-4 w-4" />
            </button>
          </div>
          <FieldError name="confirmPassword" />
        </div>

        <div className="space-y-1">
          <label htmlFor="role" className="block text-sm font-medium text-slate-700">
            Account type
          </label>
          <select id="role" value={form.role} onChange={update('role')} className={fieldClass('role')}>
            {REGISTERABLE_ROLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <FieldError name="role" />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-sm text-slate-500">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-indigo-600 hover:underline">
          Log in
        </Link>
      </p>
    </section>
  );
};

export default RegisterPage;
