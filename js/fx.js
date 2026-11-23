/* 反馈特效层：Canvas 粒子 + 飘字 + 震动 */
const FX = {
  canvas: null,
  ctx: null,
  particles: [],
  running: false,
  paused: false,
  w: 0,
  h: 0,

  init(canvas) {
    this.canvas = canvas;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      this.paused = document.hidden;
      if (!this.paused && this.particles.length) this.start();
    });
  },

  resize() {
    if (!this.canvas) return;
    const r = this.canvas.parentElement.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    this.ctx = U.hiDPI(this.canvas, this.w, this.h);
  },

  burst(x, y, opt) {
    opt = opt || {};
    const n = opt.count || 22;
    const colors = opt.colors || [CONFIG.COLOR.primary, CONFIG.COLOR.warn, '#FFFFFF', CONFIG.COLOR.primaryLight];
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 1.6 + Math.random() * (opt.speed || 4);
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 1.4,
        r: 2 + Math.random() * (opt.size || 4),
        life: 1,
        decay: 0.012 + Math.random() * 0.018,
        color: colors[(Math.random() * colors.length) | 0],
        square: Math.random() < 0.4
      });
    }
    this.start();
  },

  burstAt(elem, opt) {
    if (!elem || !this.canvas) return;
    const host = this.canvas.parentElement.getBoundingClientRect();
    const r = elem.getBoundingClientRect();
    const scale = this.w > 0 ? this.w / host.width : 1;
    this.burst((r.left + r.width / 2 - host.left) * scale, (r.top + r.height / 2 - host.top) * scale, opt);
  },

  start() {
    if (this.running || this.paused) return;
    this.running = true;
    const loop = () => {
      if (this.paused) { this.running = false; return; }
      this.step();
      if (this.particles.length > 0) requestAnimationFrame(loop);
      else { this.running = false; this.ctx.clearRect(0, 0, this.w, this.h); }
    };
    requestAnimationFrame(loop);
  },

  step() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.w, this.h);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.12; p.vx *= 0.99;
      p.life -= p.decay;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      if (p.square) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life * 6);
        ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  },

  /* 顶部飘字 */
  toast(text, kind) {
    const host = U.$('#toastLayer');
    if (!host) return;
    const t = U.el('div', 'toast ' + (kind || 'info'), U.esc(text));
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 260);
    }, CONFIG.TOAST_MS);
  },

  /* 大号飘字（记账成功） */
  floatUp(text, kind) {
    const host = U.$('#toastLayer');
    if (!host) return;
    const t = U.el('div', 'float-num ' + (kind || ''), U.esc(text));
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add('go'));
    setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 1200);
  },

  shake(elem) {
    const e = elem || U.$('#app');
    if (!e) return;
    e.classList.remove('shake');
    void e.offsetWidth;
    e.classList.add('shake');
    setTimeout(() => e.classList.remove('shake'), CONFIG.SHAKE_MS + 40);
    if (navigator.vibrate) { try { navigator.vibrate(60); } catch (err) { /* 忽略 */ } }
  },

  flash() {
    const f = U.$('#flashLayer');
    if (!f) return;
    f.classList.remove('on');
    void f.offsetWidth;
    f.classList.add('on');
    setTimeout(() => f.classList.remove('on'), 260);
  }
};
