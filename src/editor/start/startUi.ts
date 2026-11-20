import { create } from 'zustand';

/** Which start-screen panel is open (kept outside the component so lessons can return to the Learn hub). */
export const useStartUi = create<{ panel: 'templates' | 'learn' | null }>(() => ({ panel: null }));
