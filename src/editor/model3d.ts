import addon from 'virtual:ofs-runtime-3d';

/**
 * The 3D viewer add-on is embedded in the editor as the same string that
 * exports embed, and injected on first use. The editor canvas, Preview and
 * exported files therefore all run one renderer, and the editor only pays
 * for three.js when a project actually contains a 3D model.
 */
let loading: Promise<void> | null = null;

export function installModel3dLoader(win: Window = window) {
  win.__ofsModel3dLoad = () => {
    if (win.__ofsModel3d) return Promise.resolve();
    loading ??= new Promise<void>((resolve, reject) => {
      try {
        const s = win.document.createElement('script');
        s.textContent = addon;
        s.dataset.ofs = 'model3d';
        win.document.head.appendChild(s);
        if (win.__ofsModel3d) resolve();
        else reject(new Error('The 3D viewer could not start.'));
      } catch (err) {
        reject(err as Error);
      }
    });
    return loading;
  };
}
