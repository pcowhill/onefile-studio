import { useEffect } from 'react';
import { useEditor } from './editor/store/store';
import { Editor } from './editor/Editor';
import { StartScreen } from './editor/start/StartScreen';
import { Toasts } from './editor/ui/toast';
import { ContextMenu } from './editor/ui/contextMenu';
import { lastProjectId, openDraft, startAutosave } from './editor/session';
import { Coach } from './editor/learn/Coach';

export function App() {
  const hasProject = useEditor((s) => !!s.project);
  useEffect(() => {
    const stop = startAutosave();
    // Re-open the project that was open when the page was last closed.
    const last = lastProjectId();
    if (last && !new URLSearchParams(location.search).has('home')) void openDraft(last);
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
