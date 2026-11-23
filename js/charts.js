/* Canvas 图表绘制：环形图 / 趋势图 / 进度条 */
const Charts = {
  /* 环形图，返回扇区区域用于点击命中 */
  donut(canvas, list, centerTitle, centerValue) {
    const w = 320, h = 320;
    const ctx = U.hiDPI(canvas, w, h);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = 130, r = 84;
    const sum = list.reduce((s, x) => s + x.amount, 0);
    const sectors = [];

    if (sum <= 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, (R + r) / 2, 0, Math.PI * 2);
      ctx.strokeStyle = '#ECEFF3';
      ctx.lineWidth = R - r;
      ctx.stroke();
    } else {
      let a0 = -Math.PI / 2;
      list.forEach((item, i) => {
        const a1 = a0 + (item.amount / sum) * Math.PI * 2;
        const color = CONFIG.CHART_COLORS[i % CONFIG.CHART_COLORS.length];
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
        ctx.arc(cx, cy, R, a0, a1);
        ctx.arc(cx, cy, r, a1, a0, true);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
        sectors.push({ id: item.id, a0: a0, a1: a1, color: color });
        a0 = a1;
      });
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = CONFIG.COLOR.sub;
    ctx.font = '18px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText(centerTitle, cx, cy - 14);
    ctx.fillStyle = CONFIG.COLOR.text;
    ctx.font = 'bold 26px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText(centerValue, cx, cy + 22);

    return { sectors: sectors, cx: cx, cy: cy, R: R, r: r, w: w, h: h };
  },

  hitDonut(hit, px, py) {
    if (!hit) return null;
    const dx = px - hit.cx, dy = py - hit.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < hit.r || dist > hit.R) return null;
    let ang = Math.atan2(dy, dx);
    if (ang < -Math.PI / 2) ang += Math.PI * 2;
    for (let i = 0; i < hit.sectors.length; i++) {
      const s = hit.sectors[i];
      if (ang >= s.a0 && ang <= s.a1) return s.id;
    }
    return null;
  },

  /* 近 N 月：支出柱 + 收入折线 */
  trend(canvas, data) {
    const w = 640, h = 300;
    const ctx = U.hiDPI(canvas, w, h);
    ctx.clearRect(0, 0, w, h);
    const padL = 16, padR = 16, padT = 24, padB = 40;
    const cw = w - padL - padR, ch = h - padT - padB;
    let max = 0;
    data.forEach((d) => { max = Math.max(max, d.expense, d.income); });
    if (max <= 0) max = 100;
    max = max * 1.15;

    // 网格
    ctx.strokeStyle = '#EEF1F4';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = padT + ch - (ch / 3) * i;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    }

    const n = data.length;
    const slot = cw / n;
    const bw = Math.min(38, slot * 0.42);

    // 支出柱
    data.forEach((d, i) => {
      const x = padL + slot * i + slot / 2;
      const bh = (d.expense / max) * ch;
      const y = padT + ch - bh;
      const grad = ctx.createLinearGradient(0, y, 0, padT + ch);
      grad.addColorStop(0, CONFIG.COLOR.expense);
      grad.addColorStop(1, '#FFC2B9');
      ctx.fillStyle = grad;
      const rr = Math.min(6, bw / 2);
      ctx.beginPath();
      ctx.moveTo(x - bw / 2, padT + ch);
      ctx.lineTo(x - bw / 2, y + rr);
      ctx.quadraticCurveTo(x - bw / 2, y, x - bw / 2 + rr, y);
      ctx.lineTo(x + bw / 2 - rr, y);
      ctx.quadraticCurveTo(x + bw / 2, y, x + bw / 2, y + rr);
      ctx.lineTo(x + bw / 2, padT + ch);
      ctx.closePath();
      ctx.fill();
    });

    // 收入折线
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = padL + slot * i + slot / 2;
      const y = padT + ch - (d.income / max) * ch;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = CONFIG.COLOR.primary;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();
    data.forEach((d, i) => {
      const x = padL + slot * i + slot / 2;
      const y = padT + ch - (d.income / max) * ch;
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFF'; ctx.fill();
      ctx.strokeStyle = CONFIG.COLOR.primary; ctx.lineWidth = 2.5; ctx.stroke();
    });

    // 月份标签
    ctx.textAlign = 'center';
    ctx.font = '16px -apple-system, "PingFang SC", sans-serif';
    data.forEach((d, i) => {
      const x = padL + slot * i + slot / 2;
      ctx.fillStyle = i === n - 1 ? CONFIG.COLOR.text : CONFIG.COLOR.sub;
      ctx.fillText(d.label, x, h - 14);
    });

    return { padL: padL, slot: slot, n: n };
  }
};
