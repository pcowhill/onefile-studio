import { useEffect } from 'react';
import { useEditor } from './editor/store/store';
import { Editor } from './editor/Editor';
import { StartScreen } from './editor/start/StartScreen';
import { Toasts } from './editor/ui/toast';
import { ContextMenu } from './editor/ui/contextMenu';
import { lastProjectId, openDraft, openShowcase, startAutosave } from './editor/session';
import { readDeepLink, withoutOpenParam } from './editor/deepLink';
import { useStartUi } from './editor/start/startUi';
import { Coach } from './editor/learn/Coach';

export function App() {
  const hasProject = useEditor((s) => !!s.project);
  useEffect(() => {
    const stop = startAutosave();
    const link = readDeepLink(location.search);
    if (link?.kind === 'open') {
      // Links from the public site: an independent copy of a showcase. Drop the
      // parameter so a refresh keeps editing this copy instead of making another.
      openShowcase(link.id);
      history.replaceState(history.state, '', withoutOpenParam(location.href));
    } else if (link?.kind === 'panel') {
      useStartUi.setState({ panel: link.panel });
    } else if (!link) {
      // Re-open the project that was open when the page was last closed.
      const last = lastProjectId();
      if (last) void openDraft(last);
    }
    return stop;
  }, []);
  return (
    <>
      {hasProject ? <Editor /> : <StartScreen />}
      <Coach />
      <ContextMenu />
      <Toasts />
    </>
  );
}
