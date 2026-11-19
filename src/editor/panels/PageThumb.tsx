import { memo, useLayoutEffect, useRef } from 'react';
import type { Page, Project } from '../../model/types';
import { createStaticEnv } from '../../runtime/env';
import { pageHeight, renderPageStatic } from '../../runtime/mount';

/** Live miniature of a page, rendered by the playback runtime. */
export const PageThumb = memo(function PageThumb({ project, page, index, width }: { project: Project; page: Page; index: number; width: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const H = pageHeight(project, page);
  const scale = width / project.settings.width;
  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    let cleanup: (() => void) | undefined;
    // Defer a frame so typing in the inspector stays snappy.
    const t = setTimeout(() => {
      const env = createStaticEnv(project, 'thumb', index);
      const r = renderPageStatic(project, index, env, document);
      r.node.style.transform = `scale(${scale})`;
      r.node.style.transformOrigin = '0 0';
      host.replaceChildren(r.node);
      cleanup = r.destroy;
    }, 60);
    return () => {
      clearTimeout(t);
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, project.assets, project.variables, index, scale]);
  return <div className="ed-thumb ofs-editing" ref={ref} style={{ width, height: Math.round(H * scale) }} aria-hidden="true" />;
});
