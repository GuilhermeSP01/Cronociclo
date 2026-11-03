import { soundHaptics } from '../services/soundHaptics.js';

const ITEM_HEIGHT = 72;

export class WheelPicker {
  /**
   * Roleta estilo Samsung Clock com loop infinito (wrap-around) e 3 linhas visíveis.
   * @param {Object} options
   * @param {HTMLElement} options.container
   * @param {number} options.min
   * @param {number} options.max
   * @param {number} options.initialValue
   * @param {boolean} [options.padZero=true]
   * @param {(val: number) => void} options.onChange
   */
  constructor({
    container,
    min,
    max,
    initialValue,
    padZero = true,
    onChange
  }) {
    this.container = container;
    this.min = min;
    this.max = max;
    this.count = max - min + 1;
    this.value = Math.max(min, Math.min(max, initialValue));
    this.padZero = padZero;
    this.onChange = onChange;

    this.items = [];
    this.scrollTimeout = null;
    this.isProgrammaticScroll = false;

    this.render();
    this.bindEvents();
    this.setValue(this.value, false);
  }

  render() {
    this.container.innerHTML = '';
    this.scroller = document.createElement('div');
    this.scroller.className = 'wheel-scroller';
    this.scroller.setAttribute('role', 'listbox');

    const topSpacer = document.createElement('div');
    topSpacer.className = 'wheel-spacer';
    this.scroller.appendChild(topSpacer);

    this.items = [];
    // Renderiza 3 cópias consecutivas [min..max, min..max, min..max] para loop infinito (ex: 99 acima do 00)
    for (let copy = 0; copy < 3; copy++) {
      for (let v = this.min; v <= this.max; v++) {
        const item = document.createElement('div');
        item.className = 'wheel-item';
        item.dataset.value = String(v);
        item.dataset.index = String(this.items.length);
        item.setAttribute('role', 'option');
        item.textContent = this.padZero ? String(v).padStart(2, '0') : String(v);
        this.scroller.appendChild(item);
        this.items.push(item);
      }
    }

    const bottomSpacer = document.createElement('div');
    bottomSpacer.className = 'wheel-spacer';
    this.scroller.appendChild(bottomSpacer);

    this.container.appendChild(this.scroller);
  }

  bindEvents() {
    let rafPending = false;

    this.scroller.addEventListener(
      'scroll',
      () => {
        if (!rafPending) {
          rafPending = true;
          requestAnimationFrame(() => {
            rafPending = false;
            this.handleScroll();
          });
        }
      },
      { passive: true }
    );

    // Clique na linha superior ou inferior para avançar/retroceder suavemente
    this.scroller.addEventListener('click', (e) => {
      const itemEl = e.target.closest('.wheel-item');
      if (!itemEl) return;
      const clickedIndex = Number.parseInt(itemEl.dataset.index, 10);
      if (Number.isNaN(clickedIndex)) return;

      const currentIndex = Math.round(this.scroller.scrollTop / ITEM_HEIGHT);
      if (clickedIndex !== currentIndex) {
        this.isProgrammaticScroll = false;
        this.scroller.scrollTo({
          top: clickedIndex * ITEM_HEIGHT,
          behavior: 'smooth'
        });
      }
    });

    // Arrastar com o mouse no desktop
    let isDragging = false;
    let startY = 0;
    let startScrollTop = 0;

    this.scroller.addEventListener('mousedown', (e) => {
      isDragging = true;
      startY = e.clientY;
      startScrollTop = this.scroller.scrollTop;
      this.scroller.classList.add('is-dragging');
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const deltaY = startY - e.clientY;
      this.scroller.scrollTop = startScrollTop + deltaY;
    });

    window.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      this.scroller.classList.remove('is-dragging');
      this.snapToNearest();
    });
  }

  handleScroll() {
    const singleSetHeight = this.count * ITEM_HEIGHT;
    let scrollTop = this.scroller.scrollTop;

    // Mantém o scroll sempre na cópia central (cópia 1 de 0..2) sem salto visual
    if (scrollTop < singleSetHeight * 0.5) {
      scrollTop += singleSetHeight;
      this.scroller.scrollTop = scrollTop;
    } else if (scrollTop >= singleSetHeight * 2.5) {
      scrollTop -= singleSetHeight;
      this.scroller.scrollTop = scrollTop;
    }

    const rawIndex = Math.round(scrollTop / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(this.items.length - 1, rawIndex));
    const normalizedOffset = ((clampedIndex % this.count) + this.count) % this.count;
    const nextValue = this.min + normalizedOffset;

    this.updateActiveVisual(clampedIndex);

    if (nextValue !== this.value) {
      this.value = nextValue;
      if (!this.isProgrammaticScroll) {
        soundHaptics.triggerWheelTick();
      }
      if (this.onChange) {
        this.onChange(this.value);
      }
    }

    clearTimeout(this.scrollTimeout);
    this.scrollTimeout = setTimeout(() => {
      this.isProgrammaticScroll = false;
    }, 140);
  }

  snapToNearest() {
    const rawIndex = Math.round(this.scroller.scrollTop / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(this.items.length - 1, rawIndex));
    this.scroller.scrollTo({
      top: clampedIndex * ITEM_HEIGHT,
      behavior: 'smooth'
    });
  }

  updateActiveVisual(activeIndex) {
    for (let i = 0; i < this.items.length; i++) {
      const el = this.items[i];
      if (i === activeIndex) {
        el.classList.add('is-active');
        el.setAttribute('aria-selected', 'true');
      } else {
        el.classList.remove('is-active');
        el.setAttribute('aria-selected', 'false');
      }
    }
  }

  setValue(newValue, animate = false, emit = false) {
    const clamped = Math.max(this.min, Math.min(this.max, newValue));
    const offset = clamped - this.min;
    // Posiciona na cópia central (this.count + offset)
    const middleCopyIndex = this.count + offset;
    this.value = clamped;
    this.updateActiveVisual(middleCopyIndex);

    this.isProgrammaticScroll = true;
    const targetTop = middleCopyIndex * ITEM_HEIGHT;

    if (animate) {
      this.scroller.scrollTo({ top: targetTop, behavior: 'smooth' });
    } else {
      this.scroller.scrollTop = targetTop;
    }

    if (emit && this.onChange) {
      this.onChange(this.value);
    }
  }

  getValue() {
    return this.value;
  }
}
