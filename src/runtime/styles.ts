/** Playback stylesheet. Shared verbatim by the editor canvas, Preview and exported files. */
export const RUNTIME_CSS = `
.ofs-player,.ofs-page-static,.ofs-el{box-sizing:border-box}
.ofs-player *,.ofs-page-static *,.ofs-el *{box-sizing:border-box}
.ofs-player{position:relative;width:100%;height:100%;overflow:hidden;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
.ofs-el{position:absolute;transform-origin:50% 50%}
.ofs-el.ofs-hidden{display:none!important}
.ofs-anim{width:100%;height:100%;transform-origin:50% 50%}
.ofs-await>.ofs-anim{opacity:0}
.ofs-content{width:100%;height:100%;position:relative}
.ofs-clickable{cursor:pointer}
.ofs-clickable:focus-visible{outline:3px solid #6d4aff;outline-offset:4px;border-radius:6px}
.ofs-draggable{cursor:grab;user-select:none}
.ofs-dragging{cursor:grabbing;z-index:1000}
.ofs-icon{display:block;flex:none}
.ofs-text{display:flex;flex-direction:column;overflow-wrap:break-word;word-break:break-word}
.ofs-text-body{white-space:pre-wrap}
.ofs-image{overflow:hidden;width:100%;height:100%}
.ofs-image img{width:100%;height:100%;display:block;user-select:none}
.ofs-placeholder{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:#f3f0ff;color:#8a7fc0;border:2px dashed #cbc2f2;border-radius:inherit;font:600 14px system-ui,sans-serif;text-align:center;padding:8px;overflow:hidden}
.ofs-shape-svg svg,.ofs-arrow svg{display:block;overflow:visible}
.ofs-button-wrap{width:100%;height:100%}
.ofs-button{position:relative;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:.45em;border:0;padding:0 .9em;margin:0;font-weight:800;cursor:pointer;line-height:1.1;white-space:nowrap;overflow:hidden;transition:top .12s ease,box-shadow .12s ease;letter-spacing:.01em}
.ofs-button::after{content:'';position:absolute;inset:0;border-radius:inherit;background:rgba(255,255,255,0);pointer-events:none;transition:background-color .15s ease}
.ofs-button:hover{top:-1px}
.ofs-button:hover::after{background:rgba(255,255,255,.08)}
.ofs-button:active{top:3px}
.ofs-button:active::after{background:rgba(0,0,0,.04)}
.ofs-button-solid:active{box-shadow:0 2px 0 rgba(0,0,0,.15)!important}
.ofs-button-ghost:hover{background:rgba(127,127,127,.12)!important}
.ofs-button:focus-visible{outline:3px solid var(--ofs-btn);outline-offset:3px}
.ofs-button.ofs-disabled{opacity:.4;pointer-events:none;filter:grayscale(.4)}
.ofs-button-label{overflow:hidden;text-overflow:ellipsis}
.ofs-editing .ofs-button,.ofs-editing .ofs-gallery-dot,.ofs-editing .ofs-gallery-arrow{pointer-events:none;transition:none}
.ofs-editing .ofs-content{pointer-events:none}
.ofs-editing .ofs-scrolltext-body{pointer-events:auto}
.ofs-ba{position:relative;overflow:hidden;user-select:none;cursor:ew-resize;touch-action:pan-y}
.ofs-ba-v{cursor:ns-resize;touch-action:pan-x}
.ofs-ba-layer{position:absolute;inset:0}
.ofs-ba-layer img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
.ofs-ba-divider{position:absolute;background:var(--ofs-ba-accent);box-shadow:0 0 12px rgba(0,0,0,.3)}
.ofs-ba-h .ofs-ba-divider{top:0;bottom:0;width:4px;margin-left:-2px}
.ofs-ba-v .ofs-ba-divider{left:0;right:0;height:4px;margin-top:-2px}
.ofs-ba-knob{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:52px;height:52px;border-radius:50%;background:var(--ofs-ba-accent);color:#1d1b2c;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 22px rgba(0,0,0,.3);transition:transform .15s ease}
.ofs-ba-v .ofs-ba-knob{transform:translate(-50%,-50%) rotate(90deg)}
.ofs-ba-dragging .ofs-ba-knob,.ofs-ba-knob:hover{transform:translate(-50%,-50%) scale(1.1)}
.ofs-ba-v.ofs-ba-dragging .ofs-ba-knob{transform:translate(-50%,-50%) rotate(90deg) scale(1.1)}
.ofs-ba-knob:focus-visible{outline:3px solid #6d4aff;outline-offset:3px}
.ofs-ba-handle-pill .ofs-ba-knob{width:30px;height:70px;border-radius:16px}
.ofs-ba-handle-pill .ofs-ba-knob .ofs-icon{width:12px}
.ofs-ba-handle-pill.ofs-ba-v .ofs-ba-knob{width:30px;height:70px}
.ofs-ba-handle-line .ofs-ba-knob{width:18px;height:18px;border:4px solid var(--ofs-ba-accent);background:rgba(0,0,0,.25)}
.ofs-ba-label{position:absolute;top:14px;padding:6px 12px;border-radius:999px;background:rgba(18,14,40,.58);color:#fff;font:800 12px/1.2 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;pointer-events:none;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.ofs-ba-label-before{left:14px}
.ofs-ba-label-after{right:14px}
.ofs-ba-v .ofs-ba-label-after{top:auto;bottom:14px;right:auto;left:14px}
.ofs-gallery{position:relative;overflow:hidden;user-select:none}
.ofs-gallery-item{position:absolute;inset:0;opacity:0;transition:opacity .55s ease,transform .6s cubic-bezier(.22,1,.36,1)}
.ofs-gallery-item.ofs-active{opacity:1}
.ofs-gallery-item img{width:100%;height:100%;display:block}
.ofs-gallery-slide .ofs-gallery-item{opacity:1;transform:translateX(100%)}
.ofs-gallery-zoom .ofs-gallery-item{transform:scale(1.12)}
.ofs-gallery-zoom .ofs-gallery-item.ofs-active{transform:scale(1)}
.ofs-gallery-none .ofs-gallery-item{transition:none}
.ofs-gallery-dots{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:7px;padding:7px 10px;border-radius:999px;background:rgba(18,14,40,.38);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:2}
.ofs-gallery-dot{width:9px;height:9px;border-radius:5px;border:0;padding:0;background:rgba(255,255,255,.55);cursor:pointer;transition:all .25s ease}
.ofs-gallery-dot.ofs-active{background:#fff;width:24px}
.ofs-gallery-arrow{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.92);color:#1d1b2c;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.2);z-index:2;transition:transform .15s}
.ofs-gallery-arrow:hover{transform:translateY(-50%) scale(1.08)}
.ofs-gallery-arrow-prev{left:12px}
.ofs-gallery-arrow-next{right:12px}
.ofs-scrolltext{position:relative;overflow:hidden;width:100%;height:100%}
.ofs-scrolltext-body{height:100%;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--ofs-accent) transparent;outline:none}
.ofs-scrolltext-body::-webkit-scrollbar{width:8px}
.ofs-scrolltext-body::-webkit-scrollbar-thumb{background:var(--ofs-accent);border-radius:8px}
.ofs-scrolltext-body:focus-visible{box-shadow:inset 0 0 0 3px var(--ofs-accent)}
.ofs-scrolltext-title{margin:0 0 .6em;font-size:1.5em;line-height:1.2;color:var(--ofs-accent);font-weight:800}
.ofs-scrolltext-body p{margin:0 0 .9em}
.ofs-scrolltext-body h3{font-size:1.2em;margin:1.1em 0 .4em;color:var(--ofs-accent);line-height:1.25}
.ofs-scrolltext-body h4{font-size:1.05em;margin:1em 0 .35em;line-height:1.25}
.ofs-scrolltext-body ul{margin:0 0 .9em;padding-left:1.3em}
.ofs-scrolltext-body li{margin:.25em 0}
.ofs-scrolltext-body li::marker{color:var(--ofs-accent)}
.ofs-scrolltext-body strong{font-weight:800}
.ofs-scrolltext.ofs-fade .ofs-scrolltext-body{-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 30px,#000 calc(100% - 56px),transparent 100%);mask-image:linear-gradient(to bottom,transparent 0,#000 30px,#000 calc(100% - 56px),transparent 100%)}
.ofs-scrolltext.ofs-fade.ofs-at-top .ofs-scrolltext-body{-webkit-mask-image:linear-gradient(to bottom,#000 0,#000 calc(100% - 56px),transparent 100%);mask-image:linear-gradient(to bottom,#000 0,#000 calc(100% - 56px),transparent 100%)}
.ofs-scrolltext.ofs-fade.ofs-at-end .ofs-scrolltext-body{-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 30px,#000 100%);mask-image:linear-gradient(to bottom,transparent 0,#000 30px,#000 100%)}
.ofs-scrolltext.ofs-fade.ofs-at-top.ofs-at-end .ofs-scrolltext-body{-webkit-mask-image:none;mask-image:none}
.ofs-scrolltext-hint{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);color:var(--ofs-accent);pointer-events:none;animation:ofs-hint 1.6s ease-in-out infinite;transition:opacity .3s}
.ofs-at-end .ofs-scrolltext-hint{opacity:0}
@keyframes ofs-hint{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,4px)}}
.ofs-progress{display:flex;align-items:center;justify-content:center;position:relative}
.ofs-progress-track{width:100%;height:100%;border-radius:999px;overflow:hidden}
.ofs-progress-fill{height:100%;border-radius:999px;transition:width .5s cubic-bezier(.22,1,.36,1)}
.ofs-progress-label{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-variant-numeric:tabular-nums;pointer-events:none}
.ofs-progress-label-outside .ofs-progress-label{inset:auto 0 100% auto;margin-bottom:6px}
.ofs-progress-arc{transition:stroke-dashoffset .5s cubic-bezier(.22,1,.36,1)}
.ofs-unknown{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#fff4f4;color:#b42318;border:2px dashed #f3a5a5;font:600 13px system-ui,sans-serif;border-radius:8px}
.ofs-bg-image{position:absolute;inset:0;background-position:center;background-repeat:no-repeat;pointer-events:none}
.ofs-bg-dim{position:absolute;inset:0;pointer-events:none}
.ofs-page-static{position:relative;overflow:hidden}
.ofs-player-slides .ofs-stage-wrap{position:absolute;box-shadow:0 24px 70px rgba(0,0,0,.28);border-radius:2px}
.ofs-stage{position:absolute;left:0;top:0;transform-origin:0 0;overflow:hidden}
.ofs-slide{position:absolute;inset:0;overflow:hidden}
.ofs-nav{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:2px;padding:5px;border-radius:999px;background:rgba(18,14,40,.62);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#fff;opacity:.45;transition:opacity .25s;font:700 14px/1 system-ui,sans-serif;z-index:20;user-select:none}
.ofs-player:hover .ofs-nav,.ofs-nav:focus-within{opacity:1}
.ofs-nav button{width:38px;height:38px;border-radius:50%;border:0;background:transparent;color:inherit;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
.ofs-nav button:hover{background:rgba(255,255,255,.16)}
.ofs-nav button:disabled{opacity:.3;cursor:default;background:transparent}
.ofs-nav button:focus-visible{outline:2px solid #fff}
.ofs-nav-count{min-width:62px;text-align:center;font-variant-numeric:tabular-nums}
.ofs-player-page{overflow-y:auto;overflow-x:hidden}
.ofs-section{position:relative;overflow:hidden;width:100%}
.ofs-section-inner{position:relative;margin:0 auto}
.ofs-section-stage{position:absolute;left:0;top:0;transform-origin:0 0}
.ofs-error{font:16px/1.5 system-ui,sans-serif;padding:40px;color:#b42318}
@media (prefers-reduced-motion:reduce){.ofs-gallery-item,.ofs-progress-fill,.ofs-progress-arc{transition:none}.ofs-scrolltext-hint{animation:none}}
`;

export const STYLE_ID = 'ofs-runtime-styles';

export function ensureRuntimeStyles(doc: Document) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = RUNTIME_CSS;
  doc.head.appendChild(style);
}
