import { useEffect, useMemo, useState } from 'react';
import runtimeCode from 'virtual:ofs-runtime';
import type { Project } from '../../model/types';
import { useEditor, editor } from '../store/store';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { buildStandaloneHtml, byteSize, formatBytes, pruneUnusedAssets } from '../../io/exportHtml';
import { optimizeAssets, totalAssetBytes } from '../../io/assets';
import { downloadText } from '../../io/storage';
import { fileNameFor } from '../../io/escape';
import { toast } from '../ui/toast';

type Quality = 'original' | 'optimized';

export async function buildExport(project: Project, quality: Quality): Promise<{ html: string; project: Project }> {
  let p = pruneUnusedAssets(project);
  if (quality === 'optimized') p = await optimizeAssets(p);
  return { html: buildStandaloneHtml(p, runtimeCode), project: p };
}

export function ExportDialog() {
  const project = useEditor((s) => s.project)!;
  const [quality, setQuality] = useState<Quality>('original');
  const [sizes, setSizes] = useState<Partial<Record<Quality, number>>>({});
  const [busy, setBusy] = useState(false);
  const pruned = useMemo(() => pruneUnusedAssets(project), [project]);
  const images = Object.keys(pruned.assets).length;
  const hasRaster = Object.values(pruned.assets).some((a) => /png|jpeg|webp|bmp|avif/.test(a.mime));
  const stats = useMemo(() => {
    let elements = 0;
    let interactions = 0;
    for (const p of project.pages) {
      elements += p.elements.length;
      for (const e of p.elements) interactions += e.interactions.length;
    }
    return { elements, interactions };
  }, [project]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const o = await buildExport(project, 'original');
      if (cancelled) return;
      setSizes((s) => ({ ...s, original: byteSize(o.html) }));
      if (hasRaster) {
        const opt = await buildExport(project, 'optimized');
        if (!cancelled) setSizes((s) => ({ ...s, optimized: byteSize(opt.html) }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project, hasRaster]);

  const close = () => editor().set({ exportOpen: false });
  const download = async () => {
    setBusy(true);
    try {
      const { html } = await buildExport(project, quality);
      downloadText(html, fileNameFor(project.meta.title));
      toast('Exported! Open the file in any browser — or import it here later to keep editing.', 'success', 6000);
      close();
    } catch (err) {
      toast(`Export failed: ${(err as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const saving = sizes.original && sizes.optimized ? Math.max(0, 1 - sizes.optimized / sizes.original) : 0;
  return (
    <Modal onClose={close} label="Export" className="ed-export">
      <div className="ed-export-hero">
        <div className="ed-export-file">
          <Icon name="file" size={34} />
          <span>.html</span>
        </div>
        <div>
          <h2>Export one HTML file</h2>
          <p>Everything — pictures, interactions and the player — is packed into a single file that works offline. Email it, put it on a USB stick, or double-click to open it in any browser.</p>
        </div>
      </div>
      <ul className="ed-export-facts">
        <li>
          <b>{project.pages.length}</b> {project.kind === 'slides' ? 'slides' : 'sections'}
        </li>
        <li>
          <b>{stats.elements}</b> elements
        </li>
        <li>
          <b>{stats.interactions}</b> interactions
        </li>
        <li>
          <b>{images}</b> images ({formatBytes(totalAssetBytes(pruned))})
        </li>
      </ul>
      <div className="ed-quality" role="radiogroup" aria-label="Image quality">
        <button role="radio" aria-checked={quality === 'original'} className={`ed-quality-card ${quality === 'original' ? 'is-on' : ''}`} onClick={() => setQuality('original')}>
          <strong>Original quality</strong>
          <span>Images exactly as you added them.</span>
          <em>{sizes.original ? formatBytes(sizes.original) : 'Calculating…'}</em>
        </button>
        <button
          role="radio"
          aria-checked={quality === 'optimized'}
          className={`ed-quality-card ${quality === 'optimized' ? 'is-on' : ''}`}
          onClick={() => setQuality('optimized')}
          disabled={!hasRaster}
          title={hasRaster ? undefined : 'There are no photos to optimise in this project'}
        >
          <strong>Optimised {saving > 0.02 && <small className="ed-save-badge">−{Math.round(saving * 100)}%</small>}</strong>
          <span>Large photos are resized (max 1920 px) and compressed.</span>
          <em>{!hasRaster ? 'Nothing to optimise' : sizes.optimized ? formatBytes(sizes.optimized) : 'Calculating…'}</em>
        </button>
      </div>
      {quality === 'optimized' && (
        <p className="ed-export-warn">
          <Icon name="info" size={16} /> The compressed images are what you'll get back when you re-open this file for editing. Keep your original pictures if you may need full quality later.
        </p>
      )}
      <div className="ed-export-editable">
        <Icon name="check" size={16} stroke={3} /> Always editable: the full project is embedded, so you can import this file into OneFile Studio and keep working.
      </div>
      <div className="ed-modal-actions">
        <button className="ed-btn ed-btn-ghost" onClick={close}>
          Cancel
        </button>
        <button className="ed-btn ed-btn-primary ed-btn-lg" onClick={() => void download()} disabled={busy} data-testid="download-html">
          <Icon name="download" size={18} /> {busy ? 'Preparing…' : 'Download HTML'}
        </button>
      </div>
    </Modal>
  );
}
