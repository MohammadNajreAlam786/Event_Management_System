import Icon from './ui/Icon.jsx';

/**
 * Generic "coming soon" placeholder for a page whose functionality has not
 * been built yet. `eyebrow` labels the reason (e.g. a phase or "Coming soon").
 */
const PlaceholderPage = ({ title, description, eyebrow = 'Coming soon' }) => (
  <section className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
    <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
      <Icon name="settings" className="h-5 w-5" />
    </span>
    <p className="mt-3 text-xs font-medium uppercase tracking-wide text-indigo-500">{eyebrow}</p>
    <h1 className="mt-1 text-2xl font-bold text-slate-900">{title}</h1>
    <p className="mx-auto mt-1 max-w-md text-slate-500">{description}</p>
  </section>
);

export default PlaceholderPage;
