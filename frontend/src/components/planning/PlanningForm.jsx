import { useState } from 'react';

import ErrorBanner from '../ui/ErrorBanner.jsx';

/**
 * Config-driven form for the planning modals. Each planning area supplies a
 * `fields` array + `toInitial` + `toPayload` + `validate`. Entered data is
 * never discarded on a validation error; server field errors merge in.
 *
 * field: { name, label, type, options?, required?, help?, min?, rows?, colSpan? }
 *   type: 'text' | 'textarea' | 'select' | 'number' | 'datetime-local' | 'email'
 */
const PlanningForm = ({
  fields,
  toInitial,
  toPayload,
  validate,
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  busy = false,
  serverError = '',
  serverFieldErrors = null,
}) => {
  const [values, setValues] = useState(() => toInitial(initialValues ?? null));
  const [errors, setErrors] = useState({});

  const set = (name) => (e) => {
    setValues((v) => ({ ...v, [name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const err = (name) => errors[name] || serverFieldErrors?.[name];

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = validate ? validate(values) : {};
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    onSubmit(toPayload(values));
  };

  const inputClass = (name) =>
    `w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 ${
      err(name)
        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500'
        : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
    }`;

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      {serverError && <ErrorBanner message={serverError} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name} className={`space-y-1 ${f.colSpan === 2 ? 'sm:col-span-2' : ''}`}>
            <label htmlFor={`pf-${f.name}`} className="text-sm font-medium text-slate-700">
              {f.label}
              {f.required && <span className="text-rose-500"> *</span>}
            </label>

            {f.type === 'textarea' ? (
              <textarea
                id={`pf-${f.name}`}
                rows={f.rows ?? 3}
                value={values[f.name] ?? ''}
                onChange={set(f.name)}
                className={inputClass(f.name)}
              />
            ) : f.type === 'select' ? (
              <select id={`pf-${f.name}`} value={values[f.name] ?? ''} onChange={set(f.name)} className={inputClass(f.name)}>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`pf-${f.name}`}
                type={f.type}
                min={f.min}
                value={values[f.name] ?? ''}
                onChange={set(f.name)}
                className={inputClass(f.name)}
              />
            )}

            {err(f.name) && <p className="text-xs text-rose-600">{err(f.name)}</p>}
            {!err(f.name) && f.help && <p className="text-xs text-slate-400">{f.help}</p>}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default PlanningForm;
