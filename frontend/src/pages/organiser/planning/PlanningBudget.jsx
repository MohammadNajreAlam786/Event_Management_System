import { useParams } from 'react-router-dom';

import planningService from '../../../services/planningService.js';
import CrudSection from '../../../components/planning/CrudSection.jsx';
import PlanningBadge from '../../../components/planning/PlanningBadge.jsx';
import StatCard from '../../../components/StatCard.jsx';
import { BudgetForm } from '../../../components/planning/forms.jsx';
import { BUDGET_STATUSES, BUDGET_CATEGORIES, label, money } from '../../../utils/planningMeta.js';

const Totals = ({ totals }) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    <StatCard label="Total estimated" value={money(totals.estimatedTotal)} accent="slate" icon="coin" />
    <StatCard label="Total actual" value={money(totals.actualTotal)} accent="slate" icon="wallet" />
    <StatCard
      label="Variance (est − actual)"
      value={money(totals.variance)}
      accent={totals.variance < 0 ? 'rose' : 'emerald'}
      icon="trending-up"
    />
  </div>
);

const PlanningBudget = () => {
  const { id } = useParams();
  return (
    <CrudSection
      title="Budget"
      description="Estimated vs actual spend per line. Totals and variance update automatically."
      itemsKey="budget"
      addLabel="Add budget item"
      emptyTitle="No budget items yet"
      emptyDescription="Add budget lines to plan the event's spend and track it against actuals."
      emptyIcon="coin"
      deleteTitle="Delete budget item"
      deleteMessage={(b) => `Delete this ${label(b.category)} budget item?`}
      minTableWidth={760}
      filterControls={[
        { key: 'status', label: 'statuses', options: BUDGET_STATUSES.map((s) => ({ value: s, label: label(s) })) },
        { key: 'category', label: 'categories', options: BUDGET_CATEGORIES.map((c) => ({ value: c, label: label(c) })) },
      ]}
      renderSummary={(data) => <Totals totals={data.totals} />}
      fetchItems={(params) => planningService.getBudget(id, params)}
      createItem={(body) => planningService.createBudgetItem(id, body)}
      updateItem={(bid, body) => planningService.updateBudgetItem(id, bid, body)}
      deleteItem={(bid) => planningService.deleteBudgetItem(id, bid)}
      FormComponent={BudgetForm}
      columns={[
        { key: 'category', header: 'Category', className: 'font-medium text-slate-800', render: (b) => label(b.category) },
        { key: 'desc', header: 'Description', render: (b) => b.description || <span className="text-slate-400">—</span> },
        {
          key: 'est',
          header: 'Estimated',
          headClassName: 'text-right',
          className: 'text-right tabular-nums text-slate-600',
          render: (b) => money(b.estimatedAmount),
        },
        {
          key: 'act',
          header: 'Actual',
          headClassName: 'text-right',
          className: 'text-right tabular-nums text-slate-600',
          render: (b) => (b.actualAmount == null ? <span className="text-slate-400">not entered</span> : money(b.actualAmount)),
        },
        { key: 'status', header: 'Status', render: (b) => <PlanningBadge value={b.status} /> },
      ]}
    />
  );
};

export default PlanningBudget;
