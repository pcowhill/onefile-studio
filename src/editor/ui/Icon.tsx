import type { CSSProperties } from 'react';

/** Hand-tuned 24×24 stroke icons used throughout the editor. */
const P: Record<string, string> = {
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  text: 'M5 6V4.5h14V6M12 4.5v15M9 19.5h6',
  image: 'M4 5.5h16v13H4zM4 15.5l4.5-4.5 4 4 2.5-2.5 5 5M14.5 9.5a1 1 0 1 0 0-.01',
  shape: 'M4 4h9v9H4zM15.5 10.5a4.5 4.5 0 1 1-5 5',
  arrow: 'M4 19L19 5M10 5h9v9',
  button: 'M3.5 8.5a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-5M8 10.5h7M11 14l2 7 1.6-2.6L17.5 21l1.5-1.5-2.7-2.9 2.7-1.6z',
  play: 'M7 4.5v15l12.5-7.5z',
  download: 'M12 4v11M7 10.5l5 5 5-5M4.5 19.5h15',
  upload: 'M12 16V5M7 9.5l5-5 5 5M4.5 19.5h15',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5',
  copy: 'M8.5 8.5h11v11h-11zM15.5 8.5v-4h-11v11h4',
  duplicate: 'M8 8h11v11H8zM16 8V5H5v11h3M13.5 11v5M11 13.5h5',
  front: 'M8 8h12v12H8zM4 4h10v3M4 4v10h3',
  back: 'M4 4h12v12H4zM20 8v12H8v-3',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  left: 'M19 12H5M11 6l-6 6 6 6',
  right: 'M5 12h14M13 6l6 6-6 6',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  bolt: 'M13.5 3L5 13.5h6l-1 7.5 8.5-10.5h-6z',
  palette:
    'M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-1 .8-1.7 1.9-1.7h2.2a3.6 3.6 0 0 0 3.6-3.6C20.5 6.9 16.7 3.5 12 3.5zM7.5 11.5h.01M9.5 7.5h.01M14.5 7.5h.01',
  layers: 'M12 4l8.5 4.5L12 13 3.5 8.5zM3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5',
  slides: 'M3.5 5.5h17v11h-17zM8 20h8M12 16.5V20',
  page: 'M6 3.5h12v17H6zM9 8h6M9 11.5h6M9 15h3.5',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  variable: 'M8 4.5C5.5 4.5 6 9 4 12c2 3 1.5 7.5 4 7.5M16 4.5c2.5 0 2 4.5 4 7.5-2 3-1.5 7.5-4 7.5M9.5 9l5 6M14.5 9l-5 6',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeOff:
    'M4 4l16 16M10 6c.6-.2 1.3-.3 2-.3 6 0 9.5 6.3 9.5 6.3a17 17 0 0 1-2.8 3.5M6.5 7.6A16 16 0 0 0 2.5 12S6 18.3 12 18.3c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  unlock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 6.8-1.2',
  home: 'M4 11l8-7 8 7M6 9.5V20h12V9.5',
  folder: 'M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z',
  more: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
  zoomIn: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5L20 20M10.5 8v5M8 10.5h5',
  zoomOut: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5L20 20M8 10.5h5',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  alignLeft: 'M4 3.5v17M8 7h11v4H8zM8 14h7v4H8z',
  alignCenterH: 'M12 3.5v17M6 7h12v4H6zM8 14h8v4H8z',
  alignRight: 'M20 3.5v17M5 7h11v4H5zM9 14h7v4H9z',
  alignTop: 'M3.5 4h17M7 8h4v11H7zM14 8h4v7h-4z',
  alignMiddle: 'M3.5 12h17M7 6h4v12H7zM14 8h4v8h-4z',
  alignBottom: 'M3.5 20h17M7 5h4v11H7zM14 9h4v7h-4z',
  textLeft: 'M4 6h16M4 10h10M4 14h16M4 18h10',
  textCenter: 'M4 6h16M7 10h10M4 14h16M7 18h10',
  textRight: 'M4 6h16M10 10h10M4 14h16M10 18h10',
  sparkle: 'M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  hand: 'M8.5 12.5V6a1.5 1.5 0 0 1 3 0v5.5M11.5 11V4.5a1.5 1.5 0 0 1 3 0V11M14.5 11V6a1.5 1.5 0 0 1 3 0v7.5c0 4-2.5 6.5-6 6.5-2.4 0-3.8-1-5-2.8L4 13.5a1.5 1.5 0 0 1 2.4-1.8l2.1 2.3',
  clock: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5V12l3 2',
  compare: 'M12 3v18M4 5.5h16v13H4zM8.5 10l-2 2 2 2M15.5 10l2 2-2 2',
  gallery: 'M7 7.5h13v11H7zM4 15.5v-11h13M7 15.5l3.5-3.5 3 3 2-2 4.5 4.5',
  scroll: 'M5.5 4.5h13v15h-13zM8.5 8.5h7M8.5 12h7M8.5 15.5h4M20.5 7v4',
  progress: 'M3.5 9.5h17v5h-17zM3.5 12h10',
  next: 'M4.5 6.5h11a4.5 4.5 0 0 1 0 9h-11zM9 9l3 2-3 2',
  score: 'M4.5 5.5h15v13h-15zM9 9.5v5M7.5 10.5l1.5-1M12.5 9.5h3v2.5h-3v2.5h3',
  settings:
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-2.3 1.3l-.3 2h-4l-.3-2a7 7 0 0 1-2.3-1.3l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-3L2.6 9.3l2-3.4 1.9.7A7 7 0 0 1 8.8 5.3l.3-2h4l.3 2a7 7 0 0 1 2.3 1.3l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 3z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  drag: 'M9 5.5h.01M15 5.5h.01M9 12h.01M15 12h.01M9 18.5h.01M15 18.5h.01',
  file: 'M6 3.5h8l4 4v13H6zM14 3.5v4h4',
  rotate: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4v5h-5',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.8M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5',
  restart: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v5h5',
  info: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 11v5.5M12 7.6h.01',
  warning: 'M12 4l9 15.5H3zM12 10v4M12 16.8h.01',
  mouse: 'M12 3.5a5.5 5.5 0 0 0-5.5 5.5v6a5.5 5.5 0 0 0 11 0V9A5.5 5.5 0 0 0 12 3.5zM12 3.5V9.5M6.5 9.5h11',
  cursor: 'M5 3.5l13 7.2-5.6 1.4L10 17.6z',
  paste: 'M9 4.5h6v3H9zM15 5.5h3v15H6v-15h3',
  select: 'M4 4h3M10 4h4M17 4h3v3M20 10v4M20 17v3h-3M14 20h-4M7 20H4v-3M4 14v-4M4 7V4',
  chevron: 'M6 9l6 6 6-6',
  star: 'M12 3.5l2.6 5.6 6 .6-4.5 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6L3.4 9.7l6-.6z',
};

export type IconName = keyof typeof P;

export function Icon({
  name,
  size = 20,
  stroke = 2,
  style,
  className,
  fill,
}: {
  name: string;
  size?: number;
  stroke?: number;
  style?: CSSProperties;
  className?: string;
  fill?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={'ed-icon ' + (className ?? '')} style={style}>
      <path d={P[name] ?? P.sparkle} fill={fill ?? 'none'} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
