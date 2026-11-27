export interface PointerPoint {
  clientX: number;
  clientY: number;
}

/**
 * Mantém o gesto de arraste vivo enquanto as chamadas assíncronas do Owlbear
 * autorizam e iniciam a interação. O último ponto continua disponível se o
 * dedo for solto antes de startItemInteraction terminar.
 */
export class PointerDragGesture {
  readonly pointerId: number;
  readonly start: PointerPoint;
  current: PointerPoint;
  moved = false;
  released = false;
  cancelled = false;

  constructor(pointerId: number, start: PointerPoint) {
    this.pointerId = pointerId;
    this.start = { ...start };
    this.current = { ...start };
  }

  move(point: PointerPoint): void {
    if (this.cancelled || this.released) return;
    this.current = { ...point };
    if (Math.hypot(
      this.current.clientX - this.start.clientX,
      this.current.clientY - this.start.clientY,
    ) >= 3) {
      this.moved = true;
    }
  }

  release(point: PointerPoint): void {
    if (this.cancelled || this.released) return;
    this.move(point);
    this.released = true;
  }

  cancel(): void {
    this.cancelled = true;
  }

  get isActive(): boolean {
    return !this.cancelled;
  }

  get shouldMove(): boolean {
    return this.isActive && this.moved;
  }
}
