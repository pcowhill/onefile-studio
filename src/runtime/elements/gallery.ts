import type { RuntimeElementDef } from './types';
import { h, icon, num, SHADOWS } from './types';
import { assetUrl } from '../env';
import { placeholder } from './image';

export interface GalleryProps {
  images: string[];
  loop: boolean;
  transition: 'fade' | 'slide' | 'zoom' | 'none';
  advanceOnClick: boolean;
  controls: 'dots' | 'arrows' | 'both' | 'none';
  fit: 'cover' | 'contain';
  radius: number;
  shadow: string;
  /** Seconds between automatic advances. 0 = off. */
  autoplay: number;
  background: string;
}

export const galleryDef: RuntimeElementDef<GalleryProps> = {
  id: 'gallery',
  defaults: () => ({
    images: [],
    loop: true,
    transition: 'fade',
    advanceOnClick: true,
    controls: 'dots',
    fit: 'cover',
    radius: 18,
    shadow: 'lifted',
    autoplay: 0,
    background: '#1d1b2c',
  }),
  render(el, { doc, env, onCleanup }) {
    const p = el.props;
    const node = h(doc, 'div', `ofs-gallery ofs-gallery-${p.transition}`, {
      borderRadius: `${num(p.radius, 0)}px`,
      boxShadow: SHADOWS[p.shadow] ?? 'none',
      background: p.background || 'transparent',
    });
    const urls = (Array.isArray(p.images) ? p.images : []).map((id) => assetUrl(env.project, id)).filter((u): u is string => !!u);
    if (!urls.length) {
      node.appendChild(placeholder(doc, 'Gallery — add images'));
      return { node };
    }
    const items = urls.map((url, i) => {
      const item = h(doc, 'div', 'ofs-gallery-item');
      const img = h(doc, 'img');
      img.src = url;
      img.alt = `Image ${i + 1} of ${urls.length}`;
      img.draggable = false;
      img.style.objectFit = p.fit === 'contain' ? 'contain' : 'cover';
      item.appendChild(img);
      node.appendChild(item);
      return item;
    });
    const stateKey = el.id;
    let index = Math.min(urls.length - 1, Math.max(0, Number(env.state.get(stateKey) ?? 0) || 0));
    const dots: HTMLButtonElement[] = [];
    const showDots = p.controls === 'dots' || p.controls === 'both';
    const showArrows = p.controls === 'arrows' || p.controls === 'both';
    const play = env.mode === 'play';

    const paint = (from: number, dir: number) => {
      items.forEach((it, i) => {
        it.classList.toggle('ofs-active', i === index);
        if (p.transition === 'slide') {
          if (i === index && from !== index) {
            it.style.transition = 'none';
            it.style.transform = `translateX(${dir * 100}%)`;
            void it.offsetWidth;
            it.style.transition = '';
            it.style.transform = 'translateX(0)';
          } else if (i === from && from !== index) {
            it.style.transform = `translateX(${-dir * 100}%)`;
          } else if (i !== index) {
            it.style.transition = 'none';
            it.style.transform = 'translateX(100%)';
          } else it.style.transform = 'translateX(0)';
        }
      });
      dots.forEach((d, i) => d.classList.toggle('ofs-active', i === index));
      node.dataset.index = String(index);
    };
    const goTo = (i: number, dir = 1) => {
      const n = urls.length;
      let next = i;
      if (p.loop) next = ((i % n) + n) % n;
      else next = Math.max(0, Math.min(n - 1, i));
      if (next === index) return;
      const from = index;
      index = next;
      env.state.set(stateKey, index);
      paint(from, dir);
    };
    const api = { next: () => goTo(index + 1, 1), prev: () => goTo(index - 1, -1), reset: () => goTo(0, -1) };

    if (showDots && urls.length > 1) {
      const bar = h(doc, 'div', 'ofs-gallery-dots');
      urls.forEach((_, i) => {
        const d = h(doc, 'button', 'ofs-gallery-dot');
        d.type = 'button';
        d.setAttribute('aria-label', `Show image ${i + 1}`);
        if (play) {
          d.addEventListener('click', (e) => {
            e.stopPropagation();
            goTo(i, i > index ? 1 : -1);
          });
        } else d.tabIndex = -1;
        dots.push(d);
        bar.appendChild(d);
      });
      node.appendChild(bar);
    }
    if (showArrows && urls.length > 1) {
      for (const dir of [-1, 1]) {
        const b = h(doc, 'button', `ofs-gallery-arrow ofs-gallery-arrow-${dir < 0 ? 'prev' : 'next'}`);
        b.type = 'button';
        b.setAttribute('aria-label', dir < 0 ? 'Previous image' : 'Next image');
        b.appendChild(icon(doc, dir < 0 ? 'chevron-left' : 'chevron-right', 22));
        if (play) {
          b.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dir < 0) api.prev();
            else api.next();
          });
        } else b.tabIndex = -1;
        node.appendChild(b);
      }
    }
    paint(index, 1);

    if (play) {
      if (p.advanceOnClick) {
        node.classList.add('ofs-clickable');
        const click = () => api.next();
        node.addEventListener('click', click);
        onCleanup(() => node.removeEventListener('click', click));
      }
      const secs = num(p.autoplay, 0);
      if (secs > 0 && urls.length > 1) {
        const t = setInterval(() => api.next(), Math.max(1, secs) * 1000);
        onCleanup(() => clearInterval(t));
      }
    }
    return { node, api };
  },
};
