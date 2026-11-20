import type { Interaction, Project } from './types';

/** Every interaction list in a project: elements, pages (v4) and project-wide (v4). */
export function allInteractionLists(project: Project): Interaction[][] {
  const out: Interaction[][] = [];
  for (const pg of project.pages) {
    for (const el of pg.elements) out.push(el.interactions);
    if (pg.interactions) out.push(pg.interactions);
  }
  if (project.interactions) out.push(project.interactions);
  return out;
}

export function countInteractions(project: Project): number {
  return allInteractionLists(project).reduce((n, l) => n + l.length, 0);
}
