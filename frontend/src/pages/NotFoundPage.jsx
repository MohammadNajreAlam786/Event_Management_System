import { Link } from 'react-router-dom';

import Icon from '../components/ui/Icon.jsx';

const NotFoundPage = () => (
  <section className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500">
      <Icon name="alert-triangle" className="h-6 w-6" />
    </span>
    <p className="text-xs font-medium uppercase tracking-wide text-rose-500">404</p>
    <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
    <p className="text-slate-600">The page you requested does not exist.</p>
    <Link
      to="/"
      className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
    >
      <Icon name="arrow-right" className="h-4 w-4 rotate-180" />
      Back to home
    </Link>
  </section>
);

export default NotFoundPage;
