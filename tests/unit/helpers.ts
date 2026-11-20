import { createPlayer } from '../../src/runtime/player';
import type { Project } from '../../src/model/types';
import type { Player, PlayerOptions } from '../../src/runtime/player';

let last: Player | null = null;

/** Mounts a fresh player (destroying the previous one, so document-level key listeners never leak between tests). */
export function mountPlayer(project: Project, opts: PlayerOptions = {}) {
  last?.destroy();
  last = null;
  document.body.innerHTML = '';
  const host = document.createElement('div');
  document.body.appendChild(host);
  const player = createPlayer(host, project, opts);
  last = player;
  const q = (id: string) => host.querySelector<HTMLElement>(`.ofs-el[data-id="${id}"]`);
  return { host, player, q };
}

export const tick = () => new Promise((r) => setTimeout(r, 0));

export function rightClick(node: Element) {
  const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
  node.dispatchEvent(ev);
  return ev;
}
