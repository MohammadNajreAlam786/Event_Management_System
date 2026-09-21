import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import planningService from '../../../services/planningService.js';
import ReadinessCard from '../../../components/planning/ReadinessCard.jsx';
import NeedsAttention from '../../../components/planning/NeedsAttention.jsx';
import ErrorBanner from '../../../components/ui/ErrorBanner.jsx';

/** Full readiness breakdown — component scores, weights, and what to fix. */
const PlanningReadiness = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [readiness, setReadiness] = useState(null);
  const [loadState, setLoadState] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    planningService
      .getReadiness(id)
      .then((d) => {
        if (!active) return;
        setReadiness(d);
        setLoadState('ready');
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) return navigate('/login', { replace: true });
        setError(err.message || 'Could not load readiness.');
        setLoadState('error');
        return undefined;
      });
    return () => {
      active = false;
    };
  }, [id, navigate]);

  if (loadState === 'loading') return <div className="h-64 animate-pulse rounded-lg bg-slate-100" />;
  if (loadState === 'error') {
    return <ErrorBanner message={error} />;
  }

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ReadinessCard readiness={readiness} />
      <div className="space-y-4">
        <NeedsAttention items={readiness.needsAttention} />
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-500">
          <p className="font-medium text-slate-700">How this is calculated</p>
          <p className="mt-1">
            Each area scores 0–100 from your real planning data (completed tasks, available resources,
            approved budget lines, confirmed team members, a prepared schedule). The overall score is a
            weighted average — tasks {readiness.weights.tasks}%, schedule {readiness.weights.schedule}%,
            resources {readiness.weights.resources}%, budget {readiness.weights.budget}%, team{' '}
            {readiness.weights.team}%.
          </p>
        </div>
      </div>
    </section>
  );
};

export default PlanningReadiness;
