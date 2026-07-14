export {};

interface KkiapayWidgetOptions {
  amount: number;
  key: string;
  sandbox?: boolean;
  data?: string;
  position?: string;
  theme?: string;
  name?: string;
  email?: string;
  phone?: string;
}

interface KkiapayCallbackResponse {
  transactionId: string;
}

declare global {
  interface Window {
    toggleAccordion: (header: HTMLElement) => void;
    switchTab: (btn: HTMLElement) => void;
    toggleFaq: (question: HTMLElement) => void;
    goToSlide: (index: number) => void;
    handleContact: (e: Event | React.FormEvent) => void;
    updatePrice: (category: string, selectElement: HTMLSelectElement) => void;
    initJsanHomeSlider?: (opts?: { reset?: boolean }) => void;
    openKkiapayWidget?: (options: KkiapayWidgetOptions) => void;
    addSuccessListener?: (cb: (response: KkiapayCallbackResponse) => void) => void;
    addFailedListener?: (cb: (error: unknown) => void) => void;
  }
}
