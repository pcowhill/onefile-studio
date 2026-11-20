import type { ThemeId } from '../../model/types';
import { instantiateTemplate } from '../../templates';
import type { TemplateDef } from '../../templates';
import { goHome, openProject } from '../session';
import { closeCoach, startCoach } from './coach';
import { getLesson } from './lessons';
import { useStartUi } from '../start/startUi';

/** Opens an independent copy of a template in the editor, with its quick-start guide. */
export function openTemplate(def: TemplateDef, theme?: ThemeId) {
  const project = instantiateTemplate(def, theme);
  openProject(project);
  if (def.guide.length) startCoach('guide', def.id, `Customize your ${def.title}`, def.guide);
}

/** Starts a lesson in a brand-new practice project (never a user's draft). */
export function startLesson(id: string) {
  const lesson = getLesson(id);
  if (!lesson) return;
  openProject(lesson.setup());
  startCoach('lesson', lesson.id, lesson.title, lesson.steps);
}

export function restartLesson(id: string) {
  closeCoach();
  startLesson(id);
}

/** Leaves the lesson for the start screen with the Learn hub open. */
export async function backToLessons() {
  closeCoach();
  useStartUi.setState({ panel: 'learn' });
  await goHome();
}
