/**
 * Entry of the 3D add-on bundle (`virtual:ofs-runtime-3d`). Exports include
 * it (before the core runtime) only when the project contains a 3D model;
 * the editor injects the same string on first use. One renderer everywhere.
 */
import { model3dRuntime } from './viewer';

if (typeof window !== 'undefined' && !window.__ofsModel3d) window.__ofsModel3d = model3dRuntime;
