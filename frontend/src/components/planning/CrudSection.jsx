import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import EmptyState from '../EmptyState.jsx';
import ConfirmDialog from '../ConfirmDialog.jsx';
import ErrorBanner from '../ui/ErrorBanner.jsx';
import PageHeader from '../ui/PageHeader.jsx';
import Icon from '../ui/Icon.jsx';

const SEARCH_DEBOUNCE_MS = 400;

/**
 * Generic list + create/edit/delete section used by every planning area
 * (tasks, schedule, resources, budget, team). Each page supplies its
 * columns, form component, service calls and (optionally) filter controls.
 *
 * Handles: loading / error (with retry) / empty states, a debounced search,
 * dropdown filters, an add/edit modal form, and a delete confirmation —
 * refreshing in place (no full reload) and calling `onChanged` so the parent
 * can re-fetch derived data (readiness).
 */
const CrudSection = ({
  title,
  description,
  columns,
  itemsKey = 'items',
  fetchItems,
  createItem,
  updateItem,
  deleteItem,
  FormComponent,
  renderSummary,
  renderRowActions,
  filterControls = [],
  searchable = false,
  searchPlaceholder = 'Search…',
  addLabel = 'Add',
  emptyTitle = 'Nothing here yet',
  emptyDescription = 'Add the first item to get started.',
  emptyIcon = 'clipboard-list',
  deleteTitle = 'Delete item',
  deleteMessage = () => 'Are you sure you want to delete this item?',
  getId = (i) => i.id,
  onChanged,
  minTableWidth = 640,
}) => {
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [reloadKey, setReloadKey] = useState(0);

  const [data, setData] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState('');

  const [form, setForm] = useState(null); // { mode, item }
  const [formError, setFormError] = useState('');
  const [formFieldErrors, setFormFieldErrors] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(() => {
    let active = true;
    setLoadState('loading');
    setError('');
    const params = { ...filters };
    if (searchable && search) params.search = search;
    fetchItems(params)
      .then((res) => {
        if (!active) return;
        setData(res);
        setLoadState('ready');
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setError(err.message || 'Failed to load.');
        setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [fetchItems, filters, search, searchable, navigate]);

  useEffect(() => load(), [load, reloadKey]);

  const refresh = () => {
    setReloadKey((k) => k + 1);
    if (onChanged) onChanged();
  };

  const submitForm = async (payload) => {
    setBusy(true);
    setFormError('');
    setFormFieldErrors(null);
    try {
      if (form.mode === 'create') await createItem(payload);
      else await updateItem(getId(form.item), payload);
      setForm(null);
      refresh();
    } catch (err) {
      if (err.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      setFormFieldErrors(err.fieldErrors ?? null);
      setFormError(err.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await deleteItem(getId(confirm));
      setConfirm(null);
      refresh();
    } catch (err) {
      setError(err.message || 'Could not delete.');
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const items = data?.[itemsKey] ?? [];

  return (
    <section className="space-y-5">
      <PageHeader
        title={title}
        description={description}
        actions={
          <button
            type="button"
            onClick={() => {
              setForm({ mode: 'create', item: null });
              setFormError('');
              setFormFieldErrors(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Icon name="plus" className="h-4 w-4" />
            {addLabel}
          </button>
        }
      />

      {renderSummary && loadState === 'ready' && renderSummary(data)}

      {(searchable || filterControls.length > 0) && (
        <div className="flex flex-wrap items-center gap-3">
          {searchable && (
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          )}
          {filterControls.map((fc) => (
            <select
              key={fc.key}
              value={filters[fc.key] ?? ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, [fc.key]: e.target.value }))}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">{fc.allLabel ?? `All ${fc.label.toLowerCase()}`}</option>
              {fc.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}

      {loadState === 'error' && <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm" style={{ minWidth: `${minTableWidth}px` }}>
          {!(loadState === 'ready' && items.length === 0) && (
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={`px-4 py-3 font-medium ${c.headClassName ?? ''}`}>
                    {c.header}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-slate-100">
            {loadState === 'loading' &&
              Array.from({ length: 3 }).map((_, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <tr key={i}>
                  <td className="px-4 py-3" colSpan={columns.length + 1}>
                    <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                  </td>
                </tr>
              ))}

            {loadState === 'ready' &&
              items.map((item) => (
                <tr key={getId(item)} className="hover:bg-slate-50">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 align-top ${c.className ?? 'text-slate-700'}`}>
                      {c.render(item)}
                    </td>
                  ))}
                  <td className="px-4 py-3 align-top">
                    <div className="flex justify-end gap-2">
                      {renderRowActions && renderRowActions(item, refresh)}
                      <button
                        type="button"
                        onClick={() => {
                          setForm({ mode: 'edit', item });
                          setFormError('');
                          setFormFieldErrors(null);
                        }}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirm(item)}
                        className="rounded-md border border-rose-300 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {loadState === 'ready' && items.length === 0 && (
          <div className="p-4">
            <EmptyState title={emptyTitle} description={emptyDescription} icon={emptyIcon} />
          </div>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
          <div className="my-8 w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {form.mode === 'create' ? addLabel : 'Edit'}
              </h3>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Close"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
            <FormComponent
              initialValues={form.item}
              onSubmit={submitForm}
              onCancel={() => setForm(null)}
              submitLabel={form.mode === 'create' ? 'Add' : 'Save changes'}
              busy={busy}
              serverError={formError}
              serverFieldErrors={formFieldErrors}
            />
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title={deleteTitle}
          message={deleteMessage(confirm)}
          confirmLabel="Delete"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={doDelete}
        />
      )}
    </section>
  );
};

export default CrudSection;
