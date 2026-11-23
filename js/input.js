/* 输入兼容层：鼠标 + 触摸 + 物理键盘 */
const Input = {
  keyHandler: null,

  /* 统一点击（含触摸），带 44px 可点区域由 CSS 保证 */
  tap(elem, fn) {
    if (!elem) return;
    let moved = false, startY = 0, handled = false;
    elem.addEventListener('touchstart', (e) => {
      moved = false;
      startY = e.touches[0].clientY;
      elem.classList.add('pressed');
    }, { passive: true });
    elem.addEventListener('touchmove', (e) => {
      if (Math.abs(e.touches[0].clientY - startY) > 10) moved = true;
    }, { passive: true });
    elem.addEventListener('touchend', (e) => {
      elem.classList.remove('pressed');
      if (moved) return;
      handled = true;
      setTimeout(() => { handled = false; }, 400);
      Loader.unlockAudio();
      fn(e);
    });
    elem.addEventListener('touchcancel', () => elem.classList.remove('pressed'));
    elem.addEventListener('click', (e) => {
      if (handled) return;
      Loader.unlockAudio();
      fn(e);
    });
  },

  /* 事件委托：容器上按 data 属性分发 */
  delegate(root, selector, fn) {
    if (!root) return;
    root.addEventListener('click', (e) => {
      const t = e.target.closest(selector);
      if (t && root.contains(t)) { Loader.unlockAudio(); fn(t, e); }
    });
  },

  /* 左滑手势：返回 'left' 或 'right' */
  swipe(elem, fn) {
    let sx = 0, sy = 0, tracking = false;
    elem.addEventListener('touchstart', (e) => {
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
    }, { passive: true });
    elem.addEventListener('touchend', (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        fn(dx < 0 ? 'left' : 'right', e);
      }
    });
  },

  bindKeys(handler) {
    if (this.keyHandler) document.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = handler;
    document.addEventListener('keydown', handler);
  }
};
