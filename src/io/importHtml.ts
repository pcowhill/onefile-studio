import { validateProject } from '../model/validate';
import type { Project } from '../model/types';

export interface ImportResult {
  project: Project;
  warnings: string[];
}

export class ImportError extends Error {}

/**
 * Extracts the embedded project JSON from an exported HTML document. The HTML
 * is parsed inertly (DOMParser never runs scripts) and only the JSON payload is
 * read; nothing else from the file is used.
 */
export function extractProjectData(html: string): unknown {
  let text: string | null = null;
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const el = doc.getElementById('ofs-project');
    if (el && el.getAttribute('type') === 'application/json') text = el.textContent;
  } else {
    const m = /<script[^>]*id="ofs-project"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
    text = m ? m[1] : null;
  }
  if (text == null) throw new ImportError("This HTML file doesn't contain OneFile Studio project data, so it can't be opened for editing.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ImportError('The project data inside this file is damaged and could not be read.');
  }
}

export function importFromText(text: string, fileName = ''): ImportResult {
  const trimmed = text.trimStart();
  const raw = trimmed.startsWith('{') || /\.json$/i.test(fileName) ? parseJson(trimmed) : extractProjectData(text);
  const result = validateProject(raw);
  if (!result.ok) throw new ImportError(result.errors.join(' '));
  return { project: result.project, warnings: result.warnings };
}

function parseJson(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    throw new ImportError('This file is not valid project JSON.');
  }
}

export async function importFromFile(file: File): Promise<ImportResult> {
  if (file.size > 300 * 1024 * 1024) throw new ImportError('This file is too large to import (over 300 MB).');
  const text = await file.text();
  return importFromText(text, file.name);
}
