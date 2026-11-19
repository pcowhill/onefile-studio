import { useEffect, useMemo, useState } from 'react';
import runtimeCode from 'virtual:ofs-runtime';
import type { AssetKind, Project } from '../../model/types';
import { assetKind } from '../../model/types';
import { useEditor, editor } from '../store/store';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { buildStandaloneHtml, formatBytes, pruneUnusedAssets } from '../../io/exportHtml';
import { isOptimizable, optimizeAssets } from '../../io/assets';
import type { ExportEstimate } from '../../io/exportPlan';
import { assetBreakdown, estimateExport, findAssetIssues, MAX_EXPORT_CHARS, WARN_EMAIL_BYTES, WARN_LARGE_BYTES } from '../../io/exportPlan';
import { downloadText } from '../../io/storage';
import { fileNameFor } from '../../io/escape';
import { toast } from '../ui/toast';
import '../../styles/media.css';

type Quality = 'original' | 'optimized';

const plural = (n: number, word: string) => (n === 1 ? word : `${word}s`);
const KIND_ICON: Record<AssetKind, string> = { image: 'image', video: 'video', audio: 'audio' };

export async function buildExport(project: Project, quality: Quality): Promise<{ html: string; project: Project }> {
  let p = pruneUnusedAssets(project);
  if (quality === 'optimized') p = await optimizeAssets(p);
  return { html: buildStandaloneHtml(p, runtimeCode), project: p };
}

interface Plan {
  project: Project;
  estimate: ExportEstimate;
}

export function ExportDialog() {
  const project = useEditor((s) => s.project)!;
  const [quality, setQuality] = useState<Quality>('original');
  const [busy, setBusy] = useState(false);
  const [optimized, setOptimized] = useState<Plan | null>(null);
  const pruned = useMemo(() => pruneUnusedAssets(project), [project]);
  const issues = useMemo(() => findAssetIssues(project), [project]);
  // Sizes are computed from the project without building the HTML (exact; cheap even with large videos).
  const original = useMemo<Plan>(() => ({ project: pruned, estimate: estimateExport(pruned, runtimeCode) }), [pruned]);
  const hasRaster = useMemo(() => Object.values(pruned.assets).some(isOptimizable), [pruned]);
  const counts = useMemo(() => {
    const c = { image: 0, video: 0, audio: 0, kept: 0 };
    for (const a of Object.values(pruned.assets)) {
      const k = assetKind(a.mime);
      c[k]++;
      if (k !== 'image' || a.animated || a.mime === 'image/gif') c.kept++;
    }
    return c;
  }, [pruned]);
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
    if (!hasRaster) return;
    let cancelled = false;
    void optimizeAssets(pruned).then((p) => {
      if (!cancelled) setOptimized({ project: p, estimate: estimateExport(p, runtimeCode) });
    });
    return () => {
      cancelled = true;
    };
  }, [pruned, hasRaster]);

  const plan = quality === 'optimized' && optimized ? optimized : original;
  const pending = quality === 'optimized' && !optimized;
  const size = plan.estimate.bytes;
  const tooBig = plan.estimate.chars > MAX_EXPORT_CHARS;
  const blocked = issues.problems.length > 0 || tooBig;
  const breakdown = useMemo(() => assetBreakdown(plan.project, plan.estimate.bytes), [plan]);
  const assetTotal = breakdown.reduce((s, b) => s + b.bytes, 0);
  const top = breakdown.slice(0, 5);
  const restAssets = breakdown.slice(5).reduce((s, b) => s + b.bytes, 0);

  const close = () => editor().set({ exportOpen: false });
  const reveal = (pageId: string, elementId: string) => {
    editor().setPage(pageId);
    if (elementId) editor().select([elementId]);
    close();
  };
  const download = async () => {
    if (blocked) return;
    setBusy(true);
    try {
      // Let React paint "Preparing…" before the (possibly large) document is built.
      await new Promise((r) => setTimeout(r, 30));
      const final = quality === 'optimized' ? (optimized?.project ?? (await optimizeAssets(pruned))) : pruned;
      if (estimateExport(final, runtimeCode).chars > MAX_EXPORT_CHARS) throw new Error('the project is too large to fit in one file');
      const html = buildStandaloneHtml(final, runtimeCode);
      downloadText(html, fileNameFor(project.meta.title));
      toast('Exported! Open the file in any browser — or import it here later to keep editing.', 'success', 6000);
      close();
    } catch (err) {
      toast(`Export failed: ${(err as Error).message}`, 'error', 7000);
    } finally {
      setBusy(false);
    }
  };

  const saving = optimized ? Math.max(0, 1 - optimized.estimate.bytes / original.estimate.bytes) : 0;
  const noun = project.kind === 'slides' ? 'slide' : 'section';
  return (
    <Modal onClose={close} label="Export" className="ed-export">
      <div className="ed-export-hero">
        <div className="ed-export-file">
          <Icon name="file" size={34} />
          <span>.html</span>
        </div>
        <div>
          <h2>Export one HTML file</h2>
          <p>
            Everything — pictures, videos, sounds, interactions and the player — is packed into a single file that works offline. Email it, put it on a USB
            stick, or double-click to open it in any browser.
          </p>
        </div>
      </div>
      <ul className="ed-export-facts">
        <li>
          <b>{project.pages.length}</b> {plural(project.pages.length, noun)}
        </li>
        <li>
          <b>{stats.elements}</b> {plural(stats.elements, 'element')}
        </li>
        <li>
          <b>{stats.interactions}</b> {plural(stats.interactions, 'interaction')}
        </li>
        <li>
          <b>{counts.image}</b> {plural(counts.image, 'image')}
        </li>
        {counts.video > 0 && (
          <li>
            <b>{counts.video}</b> {plural(counts.video, 'video')}
          </li>
        )}
        {counts.audio > 0 && (
          <li>
            <b>{counts.audio}</b> {plural(counts.audio, 'sound')}
          </li>
        )}
      </ul>

      {issues.problems.length > 0 && (
        <div className="ed-export-alert is-error" role="alert" data-testid="export-problems">
          <Icon name="warning" size={18} />
          <div>
            <strong>Some files are missing, so this can't be exported yet</strong>
            <ul>
              {issues.problems.slice(0, 6).map((p, i) => (
                <li key={i}>
                  <b>{p.label}</b>
                  {p.elementId ? ` (${noun} ${p.pageIndex + 1})` : ''} {p.message}.{' '}
                  <button className="ed-link" onClick={() => reveal(p.pageId, p.elementId)}>
                    Show me
                  </button>
                </li>
              ))}
            </ul>
            <span>Choose a new file for it, or delete it, then export again.</span>
          </div>
        </div>
      )}

      <div className="ed-quality" role="radiogroup" aria-label="Image quality">
        <button
          role="radio"
          aria-checked={quality === 'original'}
          className={`ed-quality-card ${quality === 'original' ? 'is-on' : ''}`}
          onClick={() => setQuality('original')}
        >
          <strong>Original quality</strong>
          <span>Everything exactly as you added it.</span>
          <em>{formatBytes(original.estimate.bytes)}</em>
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
          <em>{!hasRaster ? 'Nothing to optimise' : optimized ? formatBytes(optimized.estimate.bytes) : 'Calculating…'}</em>
        </button>
      </div>
      {counts.kept > 0 && (
        <p className="ed-export-note">
          <Icon name="check" size={14} stroke={3} /> GIFs, videos and sounds are always kept exactly as they are — never re-compressed.
        </p>
      )}
      {quality === 'optimized' && (
        <p className="ed-export-warn">
          <Icon name="info" size={16} /> The compressed images are what you'll get back when you re-open this file for editing. Keep your original pictures if
          you may need full quality later.
        </p>
      )}

      <div className="ed-size" data-testid="size-breakdown">
        <div className="ed-size-head">
          <span>Estimated file size</span>
          <strong data-testid="export-size">{pending ? 'Calculating…' : formatBytes(size)}</strong>
        </div>
        {top.length > 0 && (
          <ul className="ed-size-list">
            {top.map((b) => (
              <li key={b.asset.id} data-testid="size-row">
                <Icon name={KIND_ICON[b.kind]} size={15} />
                <span className="ed-size-name" title={b.asset.name}>
                  {b.asset.name}
                  {b.asset.animated && <em> · animated</em>}
                </span>
                <span className="ed-size-bar" aria-hidden="true">
                  <i style={{ width: `${Math.max(2, b.share * 100)}%` }} />
                </span>
                <span className="ed-size-val">{formatBytes(b.bytes)}</span>
                <span className="ed-size-pct">{Math.round(b.share * 100)}%</span>
              </li>
            ))}
            {restAssets > 0 && (
              <li className="is-rest">
                <Icon name="grid" size={15} />
                <span className="ed-size-name">{breakdown.length - 5} more files</span>
                <span className="ed-size-bar" aria-hidden="true">
                  <i style={{ width: `${Math.max(2, (restAssets / size) * 100)}%` }} />
                </span>
                <span className="ed-size-val">{formatBytes(restAssets)}</span>
                <span className="ed-size-pct">{Math.round((restAssets / size) * 100)}%</span>
              </li>
            )}
            <li className="is-rest">
              <Icon name="sparkle" size={15} />
              <span className="ed-size-name">Player, text and layout</span>
              <span className="ed-size-bar" aria-hidden="true">
                <i style={{ width: `${Math.max(2, ((size - assetTotal) / size) * 100)}%` }} />
              </span>
              <span className="ed-size-val">{formatBytes(Math.max(0, size - assetTotal))}</span>
              <span className="ed-size-pct">{Math.round(((size - assetTotal) / size) * 100)}%</span>
            </li>
          </ul>
        )}
      </div>

      {tooBig ? (
        <div className="ed-export-alert is-error" role="alert" data-testid="export-too-big">
          <Icon name="warning" size={18} />
          <div>
            <strong>This project is too big for one file</strong>
            <span>
              At about {formatBytes(size)}, browsers can't reliably build or open it (the limit is roughly {formatBytes(MAX_EXPORT_CHARS)}). Remove a video or
              use shorter, smaller clips (720p is plenty for most screens).
            </span>
          </div>
        </div>
      ) : size > WARN_LARGE_BYTES ? (
        <div className="ed-export-alert" data-testid="export-size-warning">
          <Icon name="warning" size={18} />
          <div>
            <strong>That's a large file</strong>
            <span>Some browsers, phones and tablets may be slow to open it. Shorter or smaller videos make it lighter.</span>
          </div>
        </div>
      ) : size > WARN_EMAIL_BYTES ? (
        <div className="ed-export-alert" data-testid="export-size-warning">
          <Icon name="info" size={18} />
          <div>
            <strong>Probably too big to email</strong>
            <span>Most email services stop at about 25 MB. Share it with a cloud drive or a USB stick instead.</span>
          </div>
        </div>
      ) : null}
      {issues.empty.length > 0 && issues.problems.length === 0 && (
        <p className="ed-export-note">
          <Icon name="info" size={14} /> {issues.empty[0].label} {issues.empty[0].message}
          {issues.empty.length > 1 ? ` (and ${issues.empty.length - 1} more)` : ''} — viewers will see an empty placeholder.
        </p>
      )}

      <div className="ed-export-editable">
        <Icon name="check" size={16} stroke={3} /> Always editable: the full project is embedded, so you can import this file into OneFile Studio and keep
        working.
      </div>
      <div className="ed-modal-actions">
        <button className="ed-btn ed-btn-ghost" onClick={close}>
          Cancel
        </button>
        <button
          className="ed-btn ed-btn-primary ed-btn-lg"
          onClick={() => void download()}
          disabled={busy || blocked}
          data-testid="download-html"
          title={blocked ? 'Fix the problems above to export' : undefined}
        >
          <Icon name="download" size={18} /> {busy || pending ? 'Preparing…' : 'Download HTML'}
        </button>
      </div>
    </Modal>
  );
}
