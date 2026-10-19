export interface Toast {
  id: number;
  message: string;
  tone: 'default' | 'success';
}

const DEFAULT_TTL = 1600;
const MAX_VISIBLE = 3;

class ToastState {
  #items = $state<Toast[]>([]);
  #nextId = 1;
  #timers = new Map<number, number>();

  get items(): readonly Toast[] {
    return this.#items;
  }

  show(message: string, tone: Toast['tone'] = 'success', ttl = DEFAULT_TTL): void {
    const id = this.#nextId++;

    this.#items = [...this.#items, { id, message, tone }].slice(-MAX_VISIBLE);

    const timer = window.setTimeout(() => this.dismiss(id), ttl);
    this.#timers.set(id, timer);
  }

  dismiss(id: number): void {
    const timer = this.#timers.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      this.#timers.delete(id);
    }
    this.#items = this.#items.filter((item) => item.id !== id);
  }
}

export const toasts = new ToastState();