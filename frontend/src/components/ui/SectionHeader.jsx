import Icon from './Icon.jsx';

/** Small heading for a card/section within a page, with an optional icon and trailing action/link. */
const SectionHeader = ({ icon, title, action }) => (
  <div className="flex items-center justify-between gap-3">
    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
      {icon && <Icon name={icon} className="h-4 w-4 text-slate-400" />}
      {title}
    </h2>
    {action}
  </div>
);

export default SectionHeader;
