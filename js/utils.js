/* 通用工具函数 */
const U = {
  $(sel, root) { return (root || document).querySelector(sel); },
  $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); },

  el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  },

  uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  clamp(v, min, max) { return v < min ? min : (v > max ? max : v); },

  esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  debounce(fn, ms) {
    let t = null;
    return function () {
      const args = arguments, self = this;
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(self, args); }, ms);
    };
  },

  round2(n) {
    const p = Math.pow(10, CONFIG.AMOUNT_DECIMALS);
    return Math.round((Number(n) || 0) * p) / p;
  },

  /* 金额格式化：千分位 + 两位小数；超大数缩写防溢出 */
  money(n, opt) {
    n = Number(n) || 0;
    const abs = Math.abs(n);
    if (abs >= 1e8) return (n < 0 ? '-' : '') + (abs / 1e8).toFixed(2) + '亿';
    const neg = n < 0;
    const s = abs.toFixed(CONFIG.AMOUNT_DECIMALS);
    const parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const out = parts.join('.');
    if (opt === 'raw') return (neg ? '-' : '') + out;
    return (neg ? '-¥' : '¥') + out;
  },

  signMoney(type, amount) {
    if (type === 'income') return '+' + U.money(amount);
    if (type === 'transfer') return U.money(amount);
    return '-' + U.money(amount);
  },

  pad2(n) { return n < 10 ? '0' + n : '' + n; },

  todayStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + U.pad2(d.getMonth() + 1) + '-' + U.pad2(d.getDate());
  },

  monthStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + U.pad2(d.getMonth() + 1);
  },

  monthOf(dateStr) { return String(dateStr || '').slice(0, 7); },

  parseDate(s) {
    const p = String(s || '').split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2] || 1));
  },

  /* month: 'YYYY-MM'，delta 可正可负 */
  shiftMonth(month, delta) {
    const p = month.split('-');
    const d = new Date(Number(p[0]), Number(p[1]) - 1 + delta, 1);
    return U.monthStr(d);
  },

  daysInMonth(month) {
    const p = month.split('-');
    return new Date(Number(p[0]), Number(p[1]), 0).getDate();
  },

  firstWeekDay(month) {
    const p = month.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, 1).getDay();
  },

  /* 两个 YYYY-MM-DD 相差天数 */
  dayDiff(a, b) {
    const d1 = U.parseDate(a), d2 = U.parseDate(b);
    return Math.round((d1 - d2) / 86400000);
  },

  dateLabel(dateStr) {
    const today = U.todayStr();
    const diff = U.dayDiff(today, dateStr);
    if (diff === 0) return '今天';
    if (diff === 1) return '昨天';
    if (diff === 2) return '前天';
    const p = dateStr.split('-');
    const w = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][U.parseDate(dateStr).getDay()];
    return Number(p[1]) + '月' + Number(p[2]) + '日 ' + w;
  },

  monthLabel(month) {
    const p = month.split('-');
    const now = U.monthStr();
    if (month === now) return Number(p[1]) + '月';
    return p[0] + '年' + Number(p[1]) + '月';
  },

  restDaysOfMonth() {
    const now = new Date();
    return U.daysInMonth(U.monthStr(now)) - now.getDate() + 1;
  },

  hiDPI(canvas, w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  },

  download(filename, content, mime) {
    try {
      const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
      return true;
    } catch (e) { return false; }
  }
};
