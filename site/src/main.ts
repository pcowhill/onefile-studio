import '@fontsource-variable/nunito/wght.css';
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/fraunces/wght-italic.css';
import './styles.css';
import { getShowcase } from '../../src/showcase/meta';

/**
 * Landing page behaviour. Deliberately small and framework-free: the page is
 * static HTML, this only adds progressive enhancements. Nothing here loads the
 * editor, the playback runtime or three.js — "Try it" plays the exported
 * OneFile in an iframe, and the editor lives at studio/.
 */

const doc = document.documentElement;
doc.classList.add('js');
doc.classList.remove('no-js');

// Old bookmarks of the editor (`/?home`) keep working: the editor moved to studio/.
if (new URLSearchParams(location.search).has('home')) location.replace('studio/?home');

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

// ---------------------------------------------------------------- returning users
/**
 * Has this browser used the editor before (same origin as studio/)? A project
 * left open, or the editor's draft database. Read-only: the database is only
 * listed, never opened (opening would create it).
 */
async function usedStudio(): Promise<boolean> {
  try {
    if (localStorage.getItem('ofs:last-project')) return true;
  } catch {
    /* storage blocked */
  }
  try {
    const dbs = await indexedDB.databases?.();
    return !!dbs?.some((d) => d.name === 'onefile-studio');
  } catch {
    return false;
  }
}
void usedStudio().then((back) => {
  if (!back) return;
  const label = document.querySelector('.nav-cta-label');
  if (label) label.textContent = 'Open the studio';
  const wb = document.querySelector<HTMLElement>('.welcome-back');
  if (wb) wb.hidden = false;
});

// ---------------------------------------------------------------- nav
const nav = document.querySelector<HTMLElement>('.nav')!;
const toggle = document.querySelector<HTMLButtonElement>('.nav-toggle')!;
const links = document.getElementById('nav-links')!;
const setMenu = (open: boolean) => {
  toggle.setAttribute('aria-expanded', String(open));
  links.classList.toggle('is-open', open);
};
toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
links.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('a')) setMenu(false);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && links.classList.contains('is-open')) {
    setMenu(false);
    toggle.focus();
  }
});
const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 8);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------------------------------------------------------------- reveal on scroll
const reveal = new IntersectionObserver(
  (entries) => {
    for (const e of entries)
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        reveal.unobserve(e.target);
      }
  },
  { rootMargin: '0px 0px -8% 0px' },
);
document.querySelectorAll('.reveal').forEach((el) => reveal.observe(el));

// ---------------------------------------------------------------- videos
/** Only one video plays at a time (the hero counts too). */
let playing: HTMLVideoElement | null = null;
function exclusivePlay(v: HTMLVideoElement) {
  if (playing && playing !== v) playing.pause();
  playing = v;
  return v.play().catch(() => undefined);
}

// Hero: plays muted when visible (unless the viewer prefers reduced motion),
// pauses off-screen; the chapter buttons jump to a part of the tour.
const hero = document.getElementById('hero-video') as HTMLVideoElement | null;
const chapters = [...document.querySelectorAll<HTMLButtonElement>('.chapters button')];
let heroUserPaused = false;
let heroVisible = false;
if (hero) {
  hero.addEventListener('pause', () => {
    // A pause while visible and not caused by us is the viewer's choice: respect it.
    if (heroVisible && playing === hero && !document.hidden) heroUserPaused = true;
  });
  hero.addEventListener('play', () => {
    heroUserPaused = false;
    if (playing && playing !== hero) playing.pause();
    playing = hero;
  });
  new IntersectionObserver(
    ([e]) => {
      heroVisible = e.isIntersecting;
      if (!heroVisible) {
        if (!hero.paused) hero.pause();
      } else if (!reducedMotion.matches && !heroUserPaused && (!playing || playing === hero || playing.paused)) {
        void exclusivePlay(hero);
      }
    },
    { threshold: 0.35 },
  ).observe(hero);

  // Custom controls (native ones would cover the poster's headline while paused).
  const frame = hero.closest('.frame')!;
  const playBtn = document.getElementById('hv-play')!;
  const syncState = () => {
    frame.classList.toggle('is-playing', !hero.paused);
    frame.classList.toggle('is-idle', hero.paused && hero.currentTime < 0.05);
    playBtn.setAttribute('aria-label', hero.paused ? 'Play the tour' : 'Pause the tour');
  };
  ['play', 'pause', 'seeked', 'loadedmetadata'].forEach((ev) => hero.addEventListener(ev, syncState));
  syncState();
  const userPlay = () => {
    heroUserPaused = false;
    void exclusivePlay(hero);
  };
  frame.querySelector('.hv-big')!.addEventListener('click', userPlay);
  playBtn.addEventListener('click', () => {
    if (hero.paused) userPlay();
    else {
      heroUserPaused = true;
      hero.pause();
    }
  });
  hero.addEventListener('click', () => playBtn.click());
  const cc = document.getElementById('hv-cc')!;
  cc.addEventListener('click', () => {
    const track = hero.textTracks[0];
    if (!track) return;
    const on = track.mode !== 'showing';
    track.mode = on ? 'showing' : 'hidden';
    cc.setAttribute('aria-pressed', String(on));
  });
  document.getElementById('hv-fs')!.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void (frame as HTMLElement).requestFullscreen?.().catch(() => undefined);
  });

  const starts = chapters.map((b) => Number(b.dataset.t));
  hero.addEventListener('timeupdate', () => {
    const t = hero.currentTime;
    chapters.forEach((b, i) => {
      const from = starts[i];
      const to = starts[i + 1] ?? hero.duration ?? from + 1;
      const on = t >= from && t < to;
      b.classList.toggle('is-on', on);
      b.style.setProperty('--p', on ? String(Math.min(1, (t - from) / Math.max(0.1, to - from))) : '0');
      b.setAttribute('aria-current', on ? 'true' : 'false');
    });
  });
  chapters.forEach((b) =>
    b.addEventListener('click', () => {
      hero.currentTime = Number(b.dataset.t);
      heroUserPaused = false;
      void exclusivePlay(hero);
    }),
  );
}

// Showcase clips: nothing is downloaded until a clip is asked to play (hover
// or focus with a mouse, or the play button). Off-screen clips pause.
const cards = [...document.querySelectorAll<HTMLElement>('.sc-card')];
const offscreen = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      const v = e.target.querySelector('video');
      if (!e.isIntersecting && v && !v.paused) v.pause();
    }
  },
  { threshold: 0.1 },
);
for (const card of cards) {
  const v = card.querySelector<HTMLVideoElement>('video.sc-video')!;
  const btn = card.querySelector<HTMLButtonElement>('.sc-play')!;
  const title = card.querySelector('h3')?.textContent ?? 'this';
  const load = () => {
    if (!v.getAttribute('src') && v.dataset.src) {
      v.src = v.dataset.src;
      v.preload = 'auto';
    }
  };
  const sync = () => {
    const on = !v.paused;
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', `${on ? 'Pause' : 'Play'} the ${title} demo clip`);
  };
  v.addEventListener('play', sync);
  v.addEventListener('pause', sync);
  btn.addEventListener('click', () => {
    if (v.paused) {
      load();
      void exclusivePlay(v);
    } else v.pause();
  });
  // Hover previews only for mouse users who have not asked for less motion.
  card.addEventListener('pointerenter', () => {
    if (!finePointer.matches || reducedMotion.matches) return;
    load();
    void exclusivePlay(v);
  });
  card.addEventListener('pointerleave', () => {
    if (finePointer.matches && !reducedMotion.matches && !v.paused) v.pause();
  });
  offscreen.observe(card);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden && playing && !playing.paused) playing.pause();
});

// ---------------------------------------------------------------- Try it
// `#try/<id>` opens the live OneFile in a dialog (so it can be linked and the
// Back button closes it). The iframe loads the exported file itself.
const dialog = document.getElementById('try') as HTMLDialogElement;
const stage = document.getElementById('try-stage')!;
const tryTitle = document.getElementById('try-title')!;
const tryHint = document.getElementById('try-hint')!;
const tryOpen = document.getElementById('try-open') as HTMLAnchorElement;
const tryDownload = document.getElementById('try-download') as HTMLAnchorElement;
let openedByUs = false;
let returnFocus: HTMLElement | null = null;

function openTry(id: string) {
  const s = getShowcase(id);
  if (!s) return closeTry(false);
  if (playing && !playing.paused) playing.pause();
  dialog.style.setProperty('--accent', s.accent);
  tryTitle.textContent = s.title;
  tryHint.textContent = `${s.kind} · ${s.tryHint}`;
  tryOpen.href = `studio/?open=${s.id}`;
  tryDownload.href = `showcase/${s.id}.html`;
  tryDownload.setAttribute('download', s.file);
  const src = `showcase/${s.id}.html`;
  let frame = stage.querySelector('iframe');
  if (!frame || frame.dataset.id !== s.id) {
    stage.textContent = '';
    frame = document.createElement('iframe');
    frame.dataset.id = s.id;
    frame.title = `${s.title} — live OneFile`;
    frame.setAttribute('allow', 'fullscreen');
    frame.setAttribute('data-testid', 'try-frame');
    frame.src = src;
    stage.appendChild(frame);
    // Keyboard interactions (→, Space, number keys) go straight to the OneFile;
    // Esc inside it still closes the dialog (the file is same-origin).
    frame.addEventListener(
      'load',
      () => {
        const win = frame!.contentWindow;
        win?.focus();
        try {
          win?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !e.defaultPrevented && !win.document.fullscreenElement) closeTry(false);
          });
        } catch {
          /* not same-origin: the close button and the page's own Esc still work */
        }
      },
      { once: true },
    );
  }
  if (!dialog.open) {
    returnFocus = document.activeElement as HTMLElement | null;
    dialog.showModal();
    document.body.classList.add('has-dialog');
  }
  frame.focus();
}

function closeTry(fromHistory: boolean) {
  if (dialog.open) dialog.close();
  document.body.classList.remove('has-dialog');
  stage.textContent = ''; // stop media, free the 3D context
  if (!fromHistory) {
    if (openedByUs) history.back();
    else history.replaceState(history.state, '', `${location.pathname}${location.search}#examples`);
  }
  openedByUs = false;
  returnFocus?.focus({ preventScroll: true });
}

const tryFromHash = () => /^#try\/([a-z0-9-]+)$/.exec(location.hash)?.[1] ?? null;
addEventListener('hashchange', () => {
  const id = tryFromHash();
  if (id) openTry(id);
  else if (dialog.open) closeTry(true);
});
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-try]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  openedByUs = true;
  location.hash = `try/${a.dataset.try}`;
});
document.getElementById('try-close')!.addEventListener('click', () => closeTry(false));
dialog.addEventListener('cancel', (e) => {
  e.preventDefault();
  closeTry(false);
});
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) closeTry(false); // backdrop
});
const initial = tryFromHash();
if (initial) openTry(initial);
