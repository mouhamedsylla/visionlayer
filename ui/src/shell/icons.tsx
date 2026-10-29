import type { ReactNode } from "react";
import styles from "./icons.module.css";

/** Les icônes des maquettes (barre latérale, effets) : trait plein, pointillé, un carré d'accent. */
const dash = (d: ReactNode) => <g strokeDasharray="2 2">{d}</g>;
const accent = (d: ReactNode) => <g className={styles.accent}>{d}</g>;

const PATHS = {
  overview: <>
    <rect x="3" y="3" width="8" height="8" /><rect x="13" y="3" width="8" height="8" /><rect x="3" y="13" width="8" height="8" />
    {dash(<rect x="13" y="13" width="8" height="8" />)}{accent(<rect x="15.5" y="15.5" width="3" height="3" />)}
  </>,
  architecture: <>
    <rect x="2.5" y="4" width="6" height="5" /><rect x="15.5" y="3" width="6" height="5" /><rect x="15.5" y="16" width="6" height="5" />
    {dash(<path d="M8.5 6.5h7M12 6.5v12h3.5" />)}{accent(<rect x="4" y="5.5" width="3" height="2" />)}
  </>,
  features: <>
    <rect x="3" y="10.5" width="3" height="3" /><rect x="3" y="17" width="3" height="3" /><path d="M9 5.5h12M9 12h12" />
    {dash(<path d="M9 18.5h9" />)}{accent(<rect x="3" y="4" width="3" height="3" />)}
  </>,
  data: <>
    <ellipse cx="12" cy="6" rx="7.5" ry="2.8" /><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6" />
    {dash(<path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" />)}
  </>,
  contracts: <>
    <rect x="2.5" y="8" width="7" height="8" /><rect x="14.5" y="8" width="7" height="8" />
    {dash(<path d="M9.5 12h5" />)}{accent(<rect x="4.5" y="10.5" width="3" height="3" />)}
  </>,
  messages: <>
    <rect x="2.5" y="8" width="5" height="8" /><rect x="9.5" y="8" width="5" height="8" />
    {dash(<rect x="16.5" y="8" width="5" height="8" />)}{accent(<rect x="4" y="11" width="2" height="2" />)}
  </>,
  identity: <>
    <rect x="4.5" y="10.5" width="15" height="10" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    {dash(<path d="M12 14.5v2.5" />)}{accent(<rect x="10.5" y="13" width="3" height="3" />)}
  </>,
  code: <><path d="M8 6l-5 6 5 6M16 6l5 6-5 6" />{dash(<path d="M13.5 5l-3 14" />)}</>,
  technologies: <><path d="M12 3l9 5-9 5-9-5z" />{dash(<path d="M3 13l9 5 9-5" />)}</>,
  deploy: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5" />{dash(<path d="M12 12v9" />)}</>,
  reviews: <>
    <rect x="4" y="3" width="4" height="4" /><rect x="4" y="17" width="4" height="4" /><path d="M6 7v10" />
    {dash(<path d="M8 5h5a5 5 0 0 1 5 5" />)}{accent(<rect x="16" y="10" width="4" height="4" />)}
  </>,
  agents: <><rect x="4" y="7" width="16" height="13" /><path d="M12 7V3.5M9 12.5v2M15 12.5v2" />{accent(<rect x="10.5" y="2" width="3" height="3" />)}</>,
  knowledge: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" />{dash(<path d="M9 12h7M9 16h5" />)}</>,
  coverage: <><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5V12h8.5" />{accent(<rect x="13.5" y="5" width="3" height="3" />)}</>,
  settings: <>
    <circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
    {dash(<path d="M5.3 5.3l2.8 2.8M15.9 15.9l2.8 2.8M18.7 5.3l-2.8 2.8M8.1 15.9l-2.8 2.8" />)}
  </>,
  read: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />{accent(<rect x="10.5" y="10.5" width="3" height="3" />)}</>,
  write: <><path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19z" />{dash(<path d="M4 20h16" />)}</>,
  trigger: <path d="M13 2.5L5 13.5h6.5l-1 8 8.5-11h-6.5z" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
  state: <><rect x="3" y="8" width="7" height="8" />{dash(<path d="M10 12h4" />)}<rect x="14" y="8" width="7" height="8" /></>,
  check: <><path d="M4.5 12.5l4.5 4.5 10.5-10.5" /></>,
  file: <><path d="M6 3h9l4 4v14H6z" />{dash(<path d="M15 3v4h4" />)}</>,
  folder: <><path d="M3 5.5h6.5l2 2.5H21v11.5H3z" />{accent(<rect x="5.5" y="11" width="3" height="3" />)}</>,
  branch: <><circle cx="6.5" cy="5.5" r="2" /><circle cx="6.5" cy="18.5" r="2" /><circle cx="17.5" cy="8.5" r="2" /><path d="M6.5 7.5v9" />{dash(<path d="M17.5 10.5c0 4-11 3-11 6" />)}</>,
  refresh: <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 3.5v4h-4" /></>,
  collapse: <><path d="M4 4v16" /><path d="M17 6l-6 6 6 6" /></>,
  expand: <><path d="M20 4v16" /><path d="M7 6l6 6-6 6" /></>,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg className={styles.icon} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
