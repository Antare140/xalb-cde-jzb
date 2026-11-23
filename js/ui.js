/* UI 组件层：弹窗、选择器、引导、月报 */
const UI = {
  stack: 0,

  /* 关闭所有弹窗（单层叠加原则） */
  closeModal() {
    const layer = U.$('#modalLayer');
    layer.innerHTML = '';
    layer.classList.add('hidden');
    this.stack = 0;
  },

  open(html, opt) {
    opt = opt || {};
    const layer = U.$('#modalLayer');
    layer.innerHTML = '';
    const mask = U.el('div', 'modal-mask');
    const box = U.el('div', 'modal', html);
    layer.appendChild(mask);
    layer.appendChild(box);
    layer.classList.remove('hidden');
    this.stack = 1;
    if (opt.maskClose !== false) Input.tap(mask, () => this.closeModal());
    return box;
  },

  alert(title, msg, onOk) {
    const box = this.open(
      '<h3>' + U.esc(title) + '</h3><p>' + U.esc(msg) + '</p>' +
      '<div class="modal-btns"><button class="btn-primary" data-ok>知道了</button></div>'
    );
    Input.tap(U.$('[data-ok]', box), () => { this.closeModal(); if (onOk) onOk(); });
  },

  confirm(title, msg, onYes, danger) {
    const box = this.open(
      '<h3>' + U.esc(title) + '</h3><p>' + U.esc(msg) + '</p>' +
      '<div class="modal-btns"><button class="btn-ghost" data-no>取消</button>' +
      '<button class="' + (danger ? 'btn-danger' : 'btn-primary') + '" data-yes>确定</button></div>'
    );
    Input.tap(U.$('[data-no]', box), () => this.closeModal());
    Input.tap(U.$('[data-yes]', box), () => { this.closeModal(); onYes(); });
  },

  /* 单输入弹窗 */
  prompt(opt, onOk) {
    const box = this.open(
      '<h3>' + U.esc(opt.title) + '</h3>' +
      (opt.desc ? '<p>' + U.esc(opt.desc) + '</p>' : '') +
      '<div class="field"><label>' + U.esc(opt.label || '') + '</label>' +
      '<input id="promptInput" type="' + (opt.type || 'text') + '" ' +
      (opt.type === 'number' ? 'step="0.01" inputmode="decimal"' : '') +
      ' maxlength="' + (opt.maxlength || 40) + '" value="' + U.esc(opt.value == null ? '' : opt.value) + '" placeholder="' + U.esc(opt.placeholder || '') + '"></div>' +
      '<div class="modal-btns"><button class="btn-ghost" data-no>取消</button>' +
      '<button class="btn-primary" data-yes>保存</button></div>'
    );
    const input = U.$('#promptInput', box);
    setTimeout(() => { try { input.focus(); input.select(); } catch (e) { } }, 60);
    const submit = () => {
      const v = String(input.value || '').trim();
      this.closeModal();
      onOk(v);
    };
    Input.tap(U.$('[data-no]', box), () => this.closeModal());
    Input.tap(U.$('[data-yes]', box), submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  },

  /* 通用列表选择器 items: [{id,label,sub,emoji}] */
  picker(title, items, currentId, onPick, extraHtml) {
    let html = '<h3>' + U.esc(title) + '</h3><div class="opt-list">';
    items.forEach((it) => {
      html += '<div class="opt' + (it.id === currentId ? ' sel' : '') + '" data-pick="' + U.esc(it.id) + '">' +
        (it.emoji ? '<span>' + it.emoji + '</span>' : '') +
        '<span class="grow">' + U.esc(it.label) + (it.sub ? ' <span style="color:#8A9099;font-size:21px">' + U.esc(it.sub) + '</span>' : '') + '</span>' +
        (it.id === currentId ? '<span style="color:#2BB3A3">✓</span>' : '') +
        '</div>';
    });
    html += '</div>' + (extraHtml || '') +
      '<div class="modal-btns"><button class="btn-ghost" data-no>关闭</button></div>';
    const box = this.open(html);
    Input.tap(U.$('[data-no]', box), () => this.closeModal());
    Input.delegate(box, '[data-pick]', (t) => {
      this.closeModal();
      onPick(t.getAttribute('data-pick'));
    });
    return box;
  },

  /* emoji 选择块 */
  emojiPickHtml(sel) {
    let h = '<div class="field"><label>选择图标</label><div class="emoji-pick" id="emojiPick">';
    CONFIG.EMOJI_PICKER.forEach((e) => {
      h += '<span class="' + (e === sel ? 'sel' : '') + '" data-emoji="' + e + '">' + e + '</span>';
    });
    h += '</div></div>';
    return h;
  },

  bindEmojiPick(box, state) {
    Input.delegate(box, '[data-emoji]', (t) => {
      U.$$('#emojiPick span', box).forEach((s) => s.classList.remove('sel'));
      t.classList.add('sel');
      state.emoji = t.getAttribute('data-emoji');
    });
  },

  /* 空状态：图片失败降级为 emoji */
  emptyHtml(text, btnText, btnAction) {
    const img = Loader.img('emptyShark');
    const visual = img
      ? '<img src="' + CONFIG.IMAGES.emptyShark + '" alt="">'
      : '<div class="fallback">🦈</div>';
    return '<div class="empty">' + visual + '<p>' + U.esc(text) + '</p>' +
      (btnText ? '<button class="btn-mini" data-empty-act="' + U.esc(btnAction || '') + '">' + U.esc(btnText) + '</button>' : '') +
      '</div>';
  },

  /* 月报 / 里程碑弹窗 */
  reportModal(rep) {
    const img = Loader.img('medal');
    const medal = img
      ? '<div class="report-medal-wrap"><img class="medal" src="' + CONFIG.IMAGES.medal + '" alt=""><div class="report-grade">' + rep.grade + '</div></div>'
      : '<div class="report-medal-wrap"><div style="font-size:150px">🏅</div><div class="report-grade">' + rep.grade + '</div></div>';
    const gradeText = { A: '本月控得很稳', B: '记录完成，继续保持', C: '超支了，下月把预算收紧一点' }[rep.grade];
    let rows = '<div class="report-rows">' +
      '<div class="r"><span>总收入</span><b style="color:#2BB3A3">' + U.money(rep.income) + '</b></div>' +
      '<div class="r"><span>总支出</span><b style="color:#FF6B5B">' + U.money(rep.expense) + '</b></div>' +
      '<div class="r"><span>结余</span><b>' + U.money(rep.balance) + '</b></div>' +
      '<div class="r"><span>记账笔数</span><b>' + rep.count + ' 笔</b></div>';
    if (rep.topCategory) rows += '<div class="r"><span>支出最多</span><b>' + rep.topCategory.emoji + ' ' + U.esc(rep.topCategory.name) + ' ' + U.money(rep.topCategory.amount) + '</b></div>';
    if (rep.maxRecord) rows += '<div class="r"><span>最大单笔</span><b>' + U.money(rep.maxRecord.amount) + '</b></div>';
    if (rep.budget > 0) rows += '<div class="r"><span>本月预算</span><b>' + U.money(rep.budget) + (rep.over > 0 ? '（超 ' + U.money(rep.over) + '）' : '') + '</b></div>';
    rows += '</div>';

    const box = this.open(
      '<div class="report-card"><h3>' + U.esc(rep.month.replace('-', '年') + '月账单') + '</h3>' +
      medal + '<p style="margin-top:10px">' + gradeText + '</p>' + rows +
      '<div class="modal-btns"><button class="btn-primary" data-ok>收下这份月报</button></div></div>',
      { maskClose: false }
    );
    Input.tap(U.$('[data-ok]', box), () => this.closeModal());
    Loader.play(rep.grade === 'C' ? 'fail' : 'success');
    setTimeout(() => FX.burst(360, 500, { count: 40, speed: 6 }), 120);
  },

  milestoneModal(days) {
    const img = Loader.img('medal');
    const medal = img
      ? '<div class="report-medal-wrap"><img class="medal" src="' + CONFIG.IMAGES.medal + '" alt=""><div class="report-grade">' + days + '</div></div>'
      : '<div class="report-medal-wrap"><div style="font-size:150px">🏅</div><div class="report-grade">' + days + '</div></div>';
    const box = this.open(
      '<div class="report-card"><h3>连续记账 ' + days + ' 天！</h3>' + medal +
      '<p style="margin-top:10px">习惯正在养成，坚持下去钱就越来越明白～</p>' +
      '<div class="modal-btns"><button class="btn-primary" data-ok>继续加油</button></div></div>'
    );
    Input.tap(U.$('[data-ok]', box), () => this.closeModal());
    Loader.play('success');
    setTimeout(() => FX.burst(360, 520, { count: 46, speed: 6.5 }), 100);
  },

  /* 新手引导：3 步 */
  guide(onDone) {
    const layer = U.$('#guideLayer');
    const steps = [
      { sel: '#tabAdd', title: '第 1 步：点这里记一笔', text: '任何页面点底部中央的「＋」，都能立刻开始记账。', tipTop: 900 },
      { sel: '#tabbar', title: '第 2 步：五个标签页', text: '账单看流水、图表看分析、资产管余额、我的做设置。', tipTop: 880 },
      { sel: '#budgetCard', title: '第 3 步：设个月预算', text: '设置预算后，首页会显示进度条和每天还能花多少。', tipTop: 620 }
    ];
    let i = 0;
    const render = () => {
      const s = steps[i];
      const target = U.$(s.sel);
      layer.classList.remove('hidden');
      layer.innerHTML = '';
      const app = U.$('#app').getBoundingClientRect();
      const scale = 720 / app.width;
      let holeHtml = '';
      if (target) {
        const r = target.getBoundingClientRect();
        const x = (r.left - app.left) * scale, y = (r.top - app.top) * scale;
        const w = r.width * scale, h = r.height * scale;
        holeHtml = '<div class="guide-hole" style="left:' + (x - 8) + 'px;top:' + (y - 8) + 'px;width:' + (w + 16) + 'px;height:' + (h + 16) + 'px"></div>';
      } else {
        holeHtml = '<div class="guide-mask"></div>';
      }
      layer.innerHTML = holeHtml +
        '<div class="guide-tip" style="top:' + s.tipTop + 'px"><h4>' + s.title + '</h4><p>' + s.text + '</p>' +
        '<div class="guide-btns"><button class="btn-ghost" data-skip>跳过</button>' +
        '<button class="btn-primary" data-next>' + (i === steps.length - 1 ? '开始记账' : '下一步 (' + (i + 1) + '/3)') + '</button></div></div>';
      Input.tap(U.$('[data-skip]', layer), finish);
      Input.tap(U.$('[data-next]', layer), () => {
        i++;
        if (i >= steps.length) finish(); else render();
      });
    };
    const finish = () => {
      layer.classList.add('hidden');
      layer.innerHTML = '';
      Store.meta().guideDone = true;
      Store.save();
      if (onDone) onDone();
    };
    render();
  }
};
