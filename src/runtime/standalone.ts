/**
 * Entry point bundled (as an IIFE) into every exported HTML file.
 * Reads the embedded project JSON and starts the player. No network access.
 */
import type { Project } from '../model/types';
import { createPlayer } from './player';
import type { Player } from './player';

declare global {
  interface Window {
    __ofs?: { player: Player; project: Project };
  }
}

function boot() {
  const root = document.getElementById('ofs-root') ?? document.body;
  try {
    const data = document.getElementById('ofs-project');
    const project = JSON.parse(data?.textContent ?? '') as Project;
    if (!project || !Array.isArray(project.pages) || !project.pages.length) throw new Error('This file does not contain any pages.');
    const hash = /^#(\d+)$/.exec(location.hash);
    const player = createPlayer(root, project, {
      fullscreenButton: true,
      startPage: hash ? Number(hash[1]) - 1 : 0,
      onPageChange(i) {
        if (project.kind === 'slides') history.replaceState(null, '', `#${i + 1}`);
      },
    });
    player.root.focus({ preventScroll: true });
    window.__ofs = { player, project };
  } catch (err) {
    const box = document.createElement('div');
    box.className = 'ofs-error';
    box.textContent = `Sorry — this interactive document could not be started. ${(err as Error).message}`;
    root.appendChild(box);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
