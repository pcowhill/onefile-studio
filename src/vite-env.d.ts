/// <reference types="vite/client" />

declare module 'virtual:ofs-runtime' {
  /** Minified IIFE playback runtime, already escaped for inline <script> use. */
  const code: string;
  export default code;
}

declare module 'virtual:ofs-runtime-3d' {
  /** Minified IIFE 3D add-on (three.js viewer), escaped for inline <script> use. Embedded only in exports with 3D models. */
  const code: string;
  export default code;
}
