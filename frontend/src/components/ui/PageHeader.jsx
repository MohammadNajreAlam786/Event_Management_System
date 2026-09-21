/**
 * Standard page-level header: eyebrow/breadcrumb (optional), title,
 * supporting description, and a right-aligned actions slot. Used at the top
 * of most role pages in place of an ad-hoc `<h1>`/paragraph pair, so heading
 * scale and spacing stay identical across Admin/Organiser/User.
 */
const PageHeader = ({ eyebrow, title, description, actions, children }) => (
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0">
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{eyebrow}</p>}
      <h1 className="mt-0.5 text-xl font-bold text-slate-900">{title}</h1>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      {children}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export default PageHeader;
