/**
 * Small hand-rolled icon set (stroke-based, 24x24, `currentColor`) — no icon
 * library dependency, matching this project's established "no unnecessary
 * dependency" convention (Phase 10 chose a dependency-free CSS bar chart for
 * the same reason). Purely decorative by default (`aria-hidden`); pass
 * `title` for a meaningful (non-decorative) icon.
 *
 * Usage: <Icon name="calendar" className="h-5 w-5" />
 */
const PATHS = {
  dashboard: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6 2a4 4 0 0 0 4-4 4 4 0 0 0-2.34-3.65M17 21v-2a4 4 0 0 0-2-3.46',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  'user-circle': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm-5.2-2.6A6.5 6.5 0 0 1 12 15a6.5 6.5 0 0 1 5.2 2.6M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  calendar: 'M8 2v4M16 2v4M3.5 9h17M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  'calendar-check': 'M8 2v4M16 2v4M3.5 9h17M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2.5 9 2.2 2.2L15 10.7',
  'calendar-plus': 'M8 2v4M16 2v4M3.5 9h17M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm7 6v6m-3-3h6',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-15v5l3.5 2',
  'map-pin': 'M12 22s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  layers: 'm12 2 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 5 9 5 9-5',
  clipboard: 'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1ZM6 6h12a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z',
  'clipboard-check': 'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1ZM6 6h12a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3 8 2 2 4-4.5',
  'clipboard-list': 'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1ZM6 6h12a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3 6h6m-6 4h6M9 12h.01M9 16h.01',
  coin: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-15v10m-3-7.5c0-1.4 1.3-2.5 3-2.5s3 1.1 3 2.5S13.7 12 12 12s-3 1.1-3 2.5 1.3 2.5 3 2.5 3-1.1 3-2.5',
  wallet: 'M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2Zm14 7h.01',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
  'shield-check': 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3.5-9 2.5 2.5 4.5-5',
  'chart-bar': 'M4 20V10m8 10V4m8 16v-7',
  'chart-pie': 'M21.2 15.3A10 10 0 1 1 12 2v10l9.2 3.3Z',
  'trending-up': 'm3 17 6-6 4 4 8-8m0 0h-5m5 0v5',
  sparkles: 'M12 3v4m0 10v4M5 5l2.5 2.5M16.5 16.5 19 19M3 12h4m10 0h4M5 19l2.5-2.5M16.5 7.5 19 5m-9-2 1.3 3.7L16 8l-3.7 1.3L11 13l-1.3-3.7L6 8l3.7-1.3L11 3Z',
  bell: 'M6 8a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Zm3.5 10a2.5 2.5 0 0 0 5 0',
  award: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm-3.5 1.5L7 22l5-3 5 3-1.5-5.5',
  'qr-code': 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 1h2v2h-2v-2Zm4 0h2v5h-5v-2h3v-3Zm-4 4h2v1h-2v-1Z',
  star: 'm12 3 2.6 5.7 6.2.6-4.7 4.2 1.4 6.1L12 16.9 6.5 19.6l1.4-6.1-4.7-4.2 6.2-.6L12 3Z',
  'message-square': 'M4 4h16v12H8l-4 4V4Z',
  'thumbs-up': 'M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Zm0 0 4.5-7a2 2 0 0 1 3.5 1.5L14 8h5a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 17.6 20H10a3 3 0 0 1-3-3',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a8 8 0 0 0-.2-1.7l2-1.6-2-3.4-2.4 1a8 8 0 0 0-2.9-1.7L14 2h-4l-.5 2.6a8 8 0 0 0-2.9 1.7l-2.4-1-2 3.4 2 1.6A8 8 0 0 0 4 12c0 .6.1 1.1.2 1.7l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 2.9 1.7L10 22h4l.5-2.6a8 8 0 0 0 2.9-1.7l2.4 1 2-3.4-2-1.6c.1-.6.2-1.1.2-1.7Z',
  'log-out': 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m6 4 4 4-4 4m4-4H9',
  'chevron-down': 'm6 9 6 6 6-6',
  'chevron-right': 'm9 18 6-6-6-6',
  'chevron-left': 'm15 18-6-6 6-6',
  menu: 'M3 6h18M3 12h18M3 18h18',
  x: 'M18 6 6 18M6 6l12 12',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35',
  filter: 'M4 4h16l-6 8v6l-4 2v-8L4 4Z',
  plus: 'M12 5v14M5 12h14',
  download: 'M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  upload: 'M12 21V9m0 0 4 4m-4-4-4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  'eye-off': 'M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-3.2 3.9M6.5 6.6C4 8.3 2 12 2 12s3.5 7 10 7a10 10 0 0 0 3.4-.6',
  'check-circle': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm-3.5-9.5 2.5 2.5 4.5-5',
  'x-circle': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm-3-13 6 6m0-6-6 6',
  'alert-triangle': 'M10.3 3.9 2.6 17a1.5 1.5 0 0 0 1.3 2.2h16.2a1.5 1.5 0 0 0 1.3-2.2L13.7 3.9a1.5 1.5 0 0 0-2.6 0ZM12 9v4m0 4h.01',
  'alert-circle': 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-14v5m0 4h.01',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-11v5m0-8h.01',
  inbox: 'M4 4h16l3 8v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-7l3-8Zm-3 8h6l2 3h6l2-3h6',
  'file-text': 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M8 13h8m-8 4h5',
  building: 'M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17M4 21h16M9 21v-4h3v4M9 8h.01M9 12h.01M13 8h.01M13 12h.01M16 21v-9h4a1 1 0 0 1 1 1v8',
  home: 'm3 11 9-8 9 8M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10',
  'arrow-right': 'M5 12h14m0 0-6-6m6 6-6 6',
  'refresh-cw': 'M21 12a9 9 0 1 1-3-6.7M21 3v6h-6',
  'more-vertical': 'M12 5h.01M12 12h.01M12 19h.01',
};

const Icon = ({ name, className = 'h-5 w-5', strokeWidth = 1.75, title, ...rest }) => {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      {...rest}
    >
      {title && <title>{title}</title>}
      <path d={d} />
    </svg>
  );
};

export default Icon;
