import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/editor.css';
import './styles/learn.css';
import { App } from './App';
import { useEditor } from './editor/store/store';
import { ensureRuntimeStyles } from './runtime/styles';
import { ensureEditorFonts } from './io/fonts';
import { installModel3dLoader } from './editor/model3d';

ensureRuntimeStyles(document);
installModel3dLoader();
// Read-only hook used by the end-to-end tests to inspect the open project.
(window as unknown as { __ofsStudio: unknown }).__ofsStudio = { project: () => useEditor.getState().project };
ensureEditorFonts(document);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
