// jsdom lacks a few browser APIs the runtime feature-detects; provide minimal stand-ins.
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ResizeObserver ??= RO;
