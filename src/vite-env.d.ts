/// <reference types="vite/client" />

declare module 'virtual:ofs-runtime' {
  /** Minified IIFE playback runtime, already escaped for inline <script> use. */
  const code: string;
  export default code;
}
