/* 主控制器：状态管理、页面渲染、记账逻辑 */
const App = {
  tab: 'bill',
  month: U.monthStr(),
  chartMonth: U.monthStr(),
  chartType: 'expense',
  view: 'timeline',
  selDay: 0,
  listLimit: CONFIG.LIST_PAGE_SIZE,
  openedRecId: '',
  donutHit: null,

  /* 记账面板状态 */
  panel: {
    open: false,
    editId: '',
    type: 'expense',
    amountStr: '',
    categoryId: '',
    accountId: '',
    toAccountId: '',
    remark: '',
    date: U.todayStr(),
    locked: false
  },

  /* ================= 启动 ================= */
  boot() {
    this.fit();
    window.addEventListener('resize', () => this.fit());
    window.addEventListener('orientationchange', () => setTimeout(() => this.fit(), 200));

    Loader.load(
      (p) => {
        const fill = U.$('#loadFill');
        if (fill) fill.style.width = p + '%';
      },
      () => {
        Store.init();
        FX.init(U.$('#fxCanvas'));
        this.bind();
        this.applyHeaderImage();
        this.renderStorageWarn();
        this.renderAll();
        const tip = U.$('#loadTip');
        if (tip) tip.textContent = '准备好了！';
        setTimeout(() => {
          const l = U.$('#loading');
          l.classList.add('gone');
          setTimeout(() => l.classList.add('hidden'), 400);
          this.afterEnter();
        }, 320);
      }
    );
  },

  /* 等比缩放（Letterbox），保证 scaleX === scaleY */
  fit() {
    const app = U.$('#app');
    if (!app) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.min(vw / CONFIG.CANVAS_W, vh / CONFIG.CANVAS_H);
    app.style.transform = 'scale(' + scale + ')';
    if (FX.canvas) FX.resize();
  },

  applyHeaderImage() {
    if (Loader.img('header')) {
      U.$('#billHeader').style.backgroundImage = 'url(' + CONFIG.IMAGES.header + ')';
    }
  },

  afterEnter() {
    const m = Store.meta();
    if (!m.guideDone) {
      setTimeout(() => UI.guide(), 260);
      return;
    }
    this.checkMonthReport();
  },

  /* 跨月自动月报 */
  checkMonthReport() {
    const m = Store.meta();
    const now = U.monthStr();
    if (m.lastReportMonth && m.lastReportMonth !== now) {
      const last = m.lastReportMonth;
      m.lastReportMonth = now;
      Store.save();
      const rep = Store.monthReport(last);
      if (rep.count > 0) setTimeout(() => UI.reportModal(rep), 300);
    } else if (!m.lastReportMonth) {
      m.lastReportMonth = now;
      Store.save();
    }
  },

  renderStorageWarn() {
    const el = U.$('#storageWarn');
    if (Store.storageWarn) {
      el.textContent = '⚠ ' + Store.storageWarn;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  },

  /* ================= 事件绑定 ================= */
  bind() {
    // 底部 Tab
    U.$$('#tabbar .tab[data-tab]').forEach((t) => {
      Input.tap(t, () => this.switchTab(t.getAttribute('data-tab')));
    });
    Input.tap(U.$('#tabAdd'), () => this.openPanel());

    // 账本 / 月份
    Input.tap(U.$('#bookSwitch'), () => this.bookPicker());
    Input.tap(U.$('#monthPrev'), () => this.changeMonth(-1));
    Input.tap(U.$('#monthNext'), () => this.changeMonth(1));
    Input.tap(U.$('#cMonthPrev'), () => this.changeChartMonth(-1));
    Input.tap(U.$('#cMonthNext'), () => this.changeChartMonth(1));

    // 视图切换
    Input.delegate(U.$('#viewSeg'), '.seg-btn', (t) => {
      this.view = t.getAttribute('data-view');
      U.$$('#viewSeg .seg-btn').forEach((b) => b.classList.toggle('active', b === t));
      this.renderBillList();
    });
    Input.delegate(U.$('#chartSeg'), '.seg-btn', (t) => {
      this.chartType = t.getAttribute('data-ctype');
      U.$$('#chartSeg .seg-btn').forEach((b) => b.classList.toggle('active', b === t));
      this.renderChart();
    });

    // 隐私模式
    Input.tap(U.$('#privacyToggle'), () => this.togglePrivacy());

    // 账单主体委托
    const body = U.$('#billBody');
    Input.delegate(body, '[data-rec]', (t) => this.toggleRecActions(t.getAttribute('data-rec')));
    Input.delegate(body, '[data-edit]', (t) => this.openPanel(t.getAttribute('data-edit')));
    Input.delegate(body, '[data-del]', (t) => this.askDelete(t.getAttribute('data-del')));
    Input.delegate(body, '[data-budget-set]', () => this.setBudgetDialog());
    Input.delegate(body, '[data-empty-act]', (t) => {
      const act = t.getAttribute('data-empty-act');
      if (act === 'add') this.openPanel();
      else if (act === 'budget') this.setBudgetDialog();
    });
    Input.delegate(body, '[data-cal-day]', (t) => {
      this.selDay = Number(t.getAttribute('data-cal-day'));
      this.renderBillList();
    });
    Input.delegate(body, '[data-clear-demo]', () => {
      Store.clearDemo();
      FX.toast('示例流水已清除');
      this.renderAll();
    });
    Input.delegate(body, '[data-more]', () => {
      this.listLimit += CONFIG.LIST_PAGE_SIZE;
      this.renderBillList();
    });
    Input.swipe(body, (dir) => {
      if (this.view === 'calendar') this.changeMonth(dir === 'left' ? 1 : -1);
    });

    // 图表页委托
    Input.delegate(U.$('#chartBody'), '[data-drill]', (t) => this.drillCategory(t.getAttribute('data-drill')));

    // 资产页委托
    const ab = U.$('#assetBody');
    Input.delegate(ab, '[data-acc-edit]', (t) => this.accountDialog(t.getAttribute('data-acc-edit')));
    Input.delegate(ab, '[data-acc-add]', () => this.accountDialog(''));
    Input.delegate(ab, '[data-transfer]', () => this.openPanel('', 'transfer'));
    Input.delegate(ab, '[data-privacy]', () => this.togglePrivacy());

    // 我的页委托
    Input.delegate(U.$('#mineBody'), '[data-mine]', (t) => this.mineAction(t.getAttribute('data-mine')));

    // 记账面板
    Input.tap(U.$('#panelClose'), () => this.closePanel());
    Input.tap(U.$('#panelMask'), () => this.closePanel());
    Input.delegate(U.$('#typeSeg'), '.seg-btn', (t) => this.setPanelType(t.getAttribute('data-rtype')));
    Input.delegate(U.$('#catGrid'), '[data-cat]', (t) => this.pickCategory(t.getAttribute('data-cat')));
    Input.delegate(U.$('#transferBox'), '[data-tacc]', (t) => this.transferPick(t.getAttribute('data-tacc')));
    Input.tap(U.$('#metaDate'), () => this.datePicker());
    Input.tap(U.$('#metaAccount'), () => this.accountPicker());
    Input.tap(U.$('#metaRemark'), () => this.remarkDialog());
    this.buildKeypad();

    // 物理键盘
    Input.bindKeys((e) => this.onKey(e));
  },

  onKey(e) {
    const modalOpen = !U.$('#modalLayer').classList.contains('hidden');
    if (e.key === 'Escape') {
      if (modalOpen) UI.closeModal();
      else if (this.panel.open) this.closePanel();
      return;
    }
    if (modalOpen) return;
    if (!this.panel.open) {
      if (e.key === 'Enter' || e.key === '+') { this.openPanel(); e.preventDefault(); }
      return;
    }
    if (/^[0-9]$/.test(e.key)) { this.keyInput(e.key); e.preventDefault(); }
    else if (e.key === '.') { this.keyInput('.'); e.preventDefault(); }
    else if (e.key === 'Backspace') { this.keyInput('del'); e.preventDefault(); }
    else if (e.key === 'Enter') { this.saveRecord(); e.preventDefault(); }
  },

  /* ================= Tab / 月份 ================= */
  switchTab(tab) {
    if (this.tab === tab) return;
    this.tab = tab;
    const map = { bill: '#pageBill', chart: '#pageChart', asset: '#pageAsset', mine: '#pageMine' };
    U.$$('.page').forEach((p) => p.classList.remove('active'));
    U.$(map[tab]).classList.add('active');
    U.$$('#tabbar .tab[data-tab]').forEach((t) => t.classList.toggle('active', t.getAttribute('data-tab') === tab));
    if (tab === 'chart') this.renderChart();
    else if (tab === 'asset') this.renderAsset();
    else if (tab === 'mine') this.renderMine();
    else this.renderBill();
  },

  changeMonth(d) {
    this.month = U.shiftMonth(this.month, d);
    this.selDay = 0;
    this.listLimit = CONFIG.LIST_PAGE_SIZE;
    this.renderBill();
  },

  changeChartMonth(d) {
    this.chartMonth = U.shiftMonth(this.chartMonth, d);
    this.renderChart();
  },

  renderAll() {
    this.renderBill();
    if (this.tab === 'chart') this.renderChart();
    if (this.tab === 'asset') this.renderAsset();
    if (this.tab === 'mine') this.renderMine();
  },

  priv(text) {
    return Store.meta().privacy ? '****' : text;
  },

  /* ================= 账单页 ================= */
  renderBill() {
    const s = Store.summary(this.month);
    U.$('#bookName').textContent = Store.currentBook().name;
    U.$('#monthLabel').textContent = U.monthLabel(this.month);
    U.$('#sumExpense').textContent = this.priv(U.money(s.expense));
    U.$('#sumIncome').textContent = this.priv(U.money(s.income));
    U.$('#sumBalance').textContent = this.priv(U.money(s.balance));

    // 今日未记账提示
    const todayCount = Store.bookRecords().filter((r) => r.date === U.todayStr()).length;
    const tip = U.$('#tipToday');
    tip.classList.toggle('hidden', todayCount > 0);

    this.renderBudgetCard();
    this.renderBillList();
  },

  renderBudgetCard() {
    const card = U.$('#budgetCard');
    const b = Store.budgetState(this.month);
    const m = Store.meta();
    const s = Store.summary(this.month);
    const badges = '<div class="badges">' +
      '<span class="badge gold">🔥 连续记账 ' + (m.streak || 0) + ' 天</span>' +
      '<span class="badge">📝 本月 ' + s.count + ' 笔</span>' +
      '</div>';

    if (!b.set) {
      card.innerHTML = '<div class="budget-empty"><div><div class="bc-title">还没设置本月预算</div>' +
        '<div class="bc-sub">设置后可看进度和每天可用额度</div></div>' +
        '<button class="btn-mini" data-budget-set>设置预算</button></div>' + badges;
      return;
    }
    const pct = Math.min(100, Math.round(b.ratio * 100));
    let right, sub;
    if (b.level === 'over') {
      right = '<span style="color:#FF6B5B;font-weight:700">已超支 ' + this.priv(U.money(b.over)) + '</span>';
      sub = '下月把预算收紧一点吧';
    } else if (b.level === 'warn') {
      right = '<span style="color:#FFB020;font-weight:700">剩 ' + this.priv(U.money(b.left)) + '</span>';
      sub = '预算即将用完，日均可用 ' + this.priv(U.money(b.daily));
    } else {
      right = '<span style="color:#2BB3A3;font-weight:700">剩 ' + this.priv(U.money(b.left)) + '</span>';
      sub = '节奏不错，日均可用 ' + this.priv(U.money(b.daily));
    }
    card.innerHTML =
      '<div class="bc-row"><div class="bc-title">本月预算 ' + this.priv(U.money(b.total)) + '</div>' + right + '</div>' +
      '<div class="bar"><div class="bar-fill ' + b.level + '" style="width:' + pct + '%"></div></div>' +
      '<div class="bc-row"><span class="bc-sub">' + sub + '</span>' +
      '<button class="btn-mini ghost" data-budget-set>调整</button></div>' + badges;
  },

  renderBillList() {
    const tl = U.$('#timelineView'), cal = U.$('#calendarView');
    if (this.view === 'timeline') {
      tl.classList.remove('hidden');
      cal.classList.add('hidden');
      tl.innerHTML = this.timelineHtml();
    } else {
      tl.classList.add('hidden');
      cal.classList.remove('hidden');
      cal.innerHTML = this.calendarHtml();
    }
  },

  recRowHtml(r) {
    const c = Store.category(r.categoryId);
    const a = Store.account(r.accountId);
    let name, emoji, sub;
    if (r.type === 'transfer') {
      const t2 = Store.account(r.toAccountId);
      emoji = '🔄'; name = '转账';
      sub = (a ? a.name : '?') + ' → ' + (t2 ? t2.name : '?');
    } else {
      emoji = c ? c.emoji : '❓';
      name = c ? c.name : '未分类';
      sub = (a ? a.name : '') + (r.remark ? ' · ' + r.remark : '');
    }
    const cls = r.type;
    const open = this.openedRecId === r.id;
    return '<div class="rec" data-rec="' + r.id + '">' +
      '<div class="rec-ico">' + emoji + '</div>' +
      '<div class="rec-main"><div class="rec-name">' + U.esc(name) + (r.demo ? ' <span style="font-size:20px;color:#8A9099">示例</span>' : '') + '</div>' +
      '<div class="rec-sub">' + U.esc(sub) + '</div></div>' +
      '<div class="rec-amt ' + cls + '">' + this.priv(U.signMoney(r.type, r.amount)) + '</div></div>' +
      (open ? '<div class="rec-actions"><button data-edit="' + r.id + '">✏️ 编辑</button>' +
        '<button class="del" data-del="' + r.id + '">🗑 删除</button>' +
        (r.demo ? '<button data-clear-demo>清除示例</button>' : '') + '</div>' : '');
  },

  timelineHtml() {
    const list = Store.bookRecords(this.month);
    if (list.length === 0) {
      return UI.emptyHtml('本月还没有记录，点 ＋ 记下第一笔吧', '马上记一笔', 'add');
    }
    const shown = list.slice(0, this.listLimit);
    const groups = [];
    const map = {};
    shown.forEach((r) => {
      if (!map[r.date]) { map[r.date] = { date: r.date, items: [], income: 0, expense: 0 }; groups.push(map[r.date]); }
      map[r.date].items.push(r);
      if (r.type === 'income') map[r.date].income = U.round2(map[r.date].income + r.amount);
      else if (r.type === 'expense') map[r.date].expense = U.round2(map[r.date].expense + r.amount);
    });
    let html = '';
    groups.forEach((g) => {
      html += '<div class="day-group"><div class="day-head"><b>' + U.dateLabel(g.date) + '</b>' +
        '<span>支 ' + this.priv(U.money(g.expense)) + '　收 ' + this.priv(U.money(g.income)) + '</span></div>' +
        '<div class="rec-list">' + g.items.map((r) => this.recRowHtml(r)).join('') + '</div></div>';
    });
    if (list.length > shown.length) {
      html += '<div style="text-align:center;padding:10px 0 20px"><button class="btn-mini ghost" data-more>加载更多（还有 ' + (list.length - shown.length) + ' 条）</button></div>';
    }
    return html;
  },

  calendarHtml() {
    const month = this.month;
    const days = U.daysInMonth(month);
    const first = U.firstWeekDay(month);
    const dm = Store.dayMap(month);
    const today = U.todayStr();
    let html = '<div class="cal-card"><div class="cal-week">' +
      ['日', '一', '二', '三', '四', '五', '六'].map((w) => '<span>' + w + '</span>').join('') +
      '</div><div class="cal-grid">';
    for (let i = 0; i < first; i++) html += '<div class="cal-cell empty-cell"></div>';
    for (let d = 1; d <= days; d++) {
      const dateStr = month + '-' + U.pad2(d);
      const info = dm[d];
      const isToday = dateStr === today;
      const sel = this.selDay === d;
      html += '<div class="cal-cell' + (isToday ? ' today' : '') + (sel ? ' sel' : '') + '" data-cal-day="' + d + '">' +
        '<span class="d">' + d + '</span>' +
        (info && info.expense > 0 ? '<span class="e">-' + U.money(info.expense, 'raw') + '</span>' : '') +
        (info && info.income > 0 ? '<span class="i">+' + U.money(info.income, 'raw') + '</span>' : '') +
        '</div>';
    }
    html += '</div></div>';

    if (this.selDay > 0) {
      const dateStr = month + '-' + U.pad2(this.selDay);
      const items = Store.bookRecords(month).filter((r) => r.date === dateStr);
      html += '<div class="cal-day-list"><div class="cal-day-title"><span>' + U.dateLabel(dateStr) + '</span>' +
        '<span style="font-size:22px;color:#8A9099">' + items.length + ' 笔</span></div>';
      html += items.length
        ? '<div class="rec-list">' + items.map((r) => this.recRowHtml(r)).join('') + '</div>'
        : UI.emptyHtml('这天没有记录', '记一笔', 'add');
      html += '</div>';
    } else {
      html += '<div class="cal-day-list"><div class="cal-day-title"><span>点日期查看当天流水</span></div></div>';
    }
    return html;
  },

  toggleRecActions(id) {
    this.openedRecId = this.openedRecId === id ? '' : id;
    this.renderBillList();
  },

  askDelete(id) {
    const r = Store.record(id);
    if (!r) { FX.toast('该记录已不存在', 'error'); this.renderAll(); return; }
    UI.confirm('删除这笔记录？', '删除后账户余额会自动回滚，且无法恢复。', () => {
      Store.deleteRecord(id);
      this.openedRecId = '';
      FX.toast('已删除');
      this.renderAll();
    }, true);
  },

  /* ================= 记账面板 ================= */
  openPanel(editId, forceType) {
    const p = this.panel;
    p.editId = editId || '';
    if (editId) {
      const r = Store.record(editId);
      if (!r) { FX.toast('该记录已不存在', 'error'); this.renderAll(); return; }
      p.type = r.type;
      p.amountStr = r.amount.toFixed(2);
      p.categoryId = r.categoryId;
      p.accountId = r.accountId;
      p.toAccountId = r.toAccountId || '';
      p.remark = r.remark || '';
      p.date = r.date;
    } else {
      const m = Store.meta();
      p.type = forceType || 'expense';
      p.amountStr = '';
      p.categoryId = m.lastCategoryId || (Store.categories('expense')[0] || {}).id || '';
      p.accountId = m.lastAccountId || (Store.accounts()[0] || {}).id || '';
      p.toAccountId = '';
      p.remark = '';
      p.date = U.todayStr();
    }
    if (p.type === 'transfer') {
      const accs = Store.accounts();
      if (!p.accountId) p.accountId = (accs[0] || {}).id || '';
      if (!p.toAccountId) p.toAccountId = (accs.find((a) => a.id !== p.accountId) || {}).id || '';
    }
    p.open = true;
    U.$('#panelMask').classList.remove('hidden');
    const panel = U.$('#recordPanel');
    panel.classList.remove('hidden');
    requestAnimationFrame(() => panel.classList.add('show'));
    U.$$('#typeSeg .seg-btn').forEach((b) => b.classList.toggle('active', b.getAttribute('data-rtype') === p.type));
    this.renderPanel();
  },

  closePanel() {
    const panel = U.$('#recordPanel');
    panel.classList.remove('show');
    this.panel.open = false;
    setTimeout(() => {
      panel.classList.add('hidden');
      U.$('#panelMask').classList.add('hidden');
    }, CONFIG.ANIM_MS);
  },

  setPanelType(type) {
    const p = this.panel;
    if (p.type === type) return;
    p.type = type;
    U.$$('#typeSeg .seg-btn').forEach((b) => b.classList.toggle('active', b.getAttribute('data-rtype') === type));
    if (type === 'transfer') {
      const accs = Store.accounts();
      if (!p.accountId) p.accountId = (accs[0] || {}).id || '';
      if (!p.toAccountId) p.toAccountId = (accs.find((a) => a.id !== p.accountId) || {}).id || '';
    } else {
      const list = Store.categories(type);
      if (!list.some((c) => c.id === p.categoryId)) p.categoryId = (list[0] || {}).id || '';
    }
    this.renderPanel();
  },

  renderPanel() {
    const p = this.panel;
    const grid = U.$('#catGrid');
    const tbox = U.$('#transferBox');

    if (p.type === 'transfer') {
      grid.classList.add('hidden');
      tbox.classList.remove('hidden');
      const from = Store.account(p.accountId), to = Store.account(p.toAccountId);
      tbox.innerHTML = '<div class="tsel" data-tacc="from">转出：' + (from ? from.emoji + ' ' + U.esc(from.name) : '选择账户') + '</div>' +
        '<span class="arrow">⇄</span>' +
        '<div class="tsel" data-tacc="to">转入：' + (to ? to.emoji + ' ' + U.esc(to.name) : '选择账户') + '</div>';
    } else {
      tbox.classList.add('hidden');
      grid.classList.remove('hidden');
      grid.innerHTML = Store.categories(p.type).map((c) =>
        '<div class="cat' + (c.id === p.categoryId ? ' sel' : '') + '" data-cat="' + c.id + '">' +
        '<span class="ce">' + c.emoji + '</span><span>' + U.esc(c.name) + '</span></div>'
      ).join('');
    }

    const sign = p.type === 'income' ? '+' : (p.type === 'transfer' ? '⇄' : '-');
    U.$('#amountSign').textContent = sign;
    U.$('#amountSign').style.color = p.type === 'income' ? CONFIG.COLOR.primary : (p.type === 'transfer' ? CONFIG.COLOR.transfer : CONFIG.COLOR.expense);
    U.$('#amountVal').textContent = p.amountStr === '' ? '0.00' : p.amountStr;

    U.$('#metaDate').textContent = '📅 ' + (p.date === U.todayStr() ? '今天' : p.date.slice(5));
    const acc = Store.account(p.accountId);
    U.$('#metaAccount').textContent = (acc ? acc.emoji + ' ' + acc.name : '💳 选择账户');
    U.$('#metaAccount').classList.toggle('hidden', p.type === 'transfer');
    U.$('#metaRemark').textContent = p.remark ? '✏️ ' + p.remark : '✏️ 加备注';
  },

  pickCategory(id) {
    this.panel.categoryId = id;
    this.renderPanel();
  },

  buildKeypad() {
    const keys = [
      ['1', 'num'], ['2', 'num'], ['3', 'num'], ['⌫', 'del'],
      ['4', 'num'], ['5', 'num'], ['6', 'num'], ['保存', 'save'],
      ['7', 'num'], ['8', 'num'], ['9', 'num'],
      ['.', 'num'], ['0', 'num'], ['清空', 'clear']
    ];
    const pad = U.$('#keypad');
    pad.innerHTML = keys.map((k) => {
      if (k[1] === 'save') return '<div class="key save" data-k="save">' + k[0] + '</div>';
      if (k[1] === 'num') return '<div class="key" data-k="' + k[0] + '">' + k[0] + '</div>';
      return '<div class="key fn" data-k="' + k[1] + '">' + k[0] + '</div>';
    }).join('');
    Input.delegate(pad, '[data-k]', (t) => {
      const k = t.getAttribute('data-k');
      if (k === 'save') this.saveRecord();
      else if (k === 'clear') this.keyInput('clear');
      else if (k === 'del') this.keyInput('del');
      else this.keyInput(k);
    });
  },

  keyInput(k) {
    const p = this.panel;
    let s = p.amountStr;
    if (k === 'del') s = s.slice(0, -1);
    else if (k === 'clear') s = '';
    else if (k === '.') {
      if (s.indexOf('.') >= 0) return;
      s = (s === '' ? '0' : s) + '.';
    } else {
      // 禁止前导多个 0
      if (s === '0') s = k === '0' ? '0' : k;
      else s = s + k;
      // 限制两位小数
      const dot = s.indexOf('.');
      if (dot >= 0 && s.length - dot - 1 > CONFIG.AMOUNT_DECIMALS) return;
      if (Number(s) > CONFIG.MAX_AMOUNT) {
        FX.toast('单笔金额不能超过 ' + U.money(CONFIG.MAX_AMOUNT), 'error');
        Loader.play('fail');
        return;
      }
    }
    p.amountStr = s;
    U.$('#amountVal').textContent = s === '' ? '0.00' : s;
  },

  datePicker() {
    const p = this.panel;
    UI.prompt({ title: '选择日期', label: '日期（YYYY-MM-DD）', type: 'date', value: p.date }, (v) => {
      if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) { FX.toast('日期格式不正确', 'error'); return; }
      p.date = v;
      this.renderPanel();
    });
  },

  accountPicker() {
    const p = this.panel;
    const items = Store.accounts().map((a) => ({ id: a.id, label: a.name, sub: U.money(a.balance), emoji: a.emoji }));
    UI.picker('选择账户', items, p.accountId, (id) => { p.accountId = id; this.renderPanel(); });
  },

  transferPick(which) {
    const p = this.panel;
    const items = Store.accounts().map((a) => ({ id: a.id, label: a.name, sub: U.money(a.balance), emoji: a.emoji }));
    UI.picker(which === 'from' ? '选择转出账户' : '选择转入账户', items,
      which === 'from' ? p.accountId : p.toAccountId,
      (id) => {
        if (which === 'from') { p.accountId = id; if (p.toAccountId === id) p.toAccountId = ''; }
        else { p.toAccountId = id; if (p.accountId === id) p.accountId = ''; }
        this.renderPanel();
      });
  },

  remarkDialog() {
    const p = this.panel;
    UI.prompt({
      title: '添加备注', label: '最多 ' + CONFIG.REMARK_MAX_LEN + ' 字',
      value: p.remark, maxlength: CONFIG.REMARK_MAX_LEN, placeholder: '例如：和同事吃午饭'
    }, (v) => {
      p.remark = v.slice(0, CONFIG.REMARK_MAX_LEN);
      this.renderPanel();
    });
  },

  saveRecord() {
    const p = this.panel;
    if (p.locked) return;
    const amount = U.round2(Number(p.amountStr));
    if (!p.amountStr || isNaN(amount) || amount < CONFIG.MIN_AMOUNT) {
      FX.toast('请输入有效金额（至少 ' + U.money(CONFIG.MIN_AMOUNT) + '）', 'error');
      Loader.play('fail');
      FX.shake(U.$('#recordPanel'));
      return;
    }
    if (amount > CONFIG.MAX_AMOUNT) {
      FX.toast('金额超出上限', 'error'); Loader.play('fail'); return;
    }
    if (p.type === 'transfer') {
      if (!p.accountId || !p.toAccountId) { FX.toast('请选择转出和转入账户', 'error'); Loader.play('fail'); return; }
      if (p.accountId === p.toAccountId) { FX.toast('转出转入账户不能相同', 'error'); Loader.play('fail'); return; }
    } else {
      if (!p.categoryId) { FX.toast('请选择分类', 'error'); Loader.play('fail'); return; }
      if (!p.accountId) { FX.toast('请选择账户', 'error'); Loader.play('fail'); return; }
    }

    // 防连点
    p.locked = true;
    const saveKey = U.$('#keypad [data-k="save"]');
    if (saveKey) saveKey.classList.add('lock');
    setTimeout(() => {
      p.locked = false;
      if (saveKey) saveKey.classList.remove('lock');
    }, CONFIG.SAVE_LOCK_MS);

    const payload = {
      type: p.type, amount: amount, categoryId: p.type === 'transfer' ? '' : p.categoryId,
      accountId: p.accountId, toAccountId: p.type === 'transfer' ? p.toAccountId : '',
      remark: p.remark, date: p.date
    };

    let res, streak = null;
    if (p.editId) {
      res = Store.updateRecord(p.editId, payload);
    } else {
      res = Store.addRecord(payload);
      streak = res.streak;
    }
    if (!res.ok) { FX.toast(res.msg || '保存失败', 'error'); Loader.play('fail'); return; }

    // 反馈
    const c = Store.category(payload.categoryId);
    const label = p.type === 'transfer' ? '转账' : (c ? c.name : '');
    FX.floatUp(U.signMoney(p.type, amount) + ' ' + label, p.type === 'income' ? 'income' : '');
    FX.burstAt(U.$('#keypad [data-k="save"]'), { count: 26 });
    Loader.play('success');

    this.month = U.monthOf(payload.date);
    this.chartMonth = this.month;
    this.openedRecId = '';
    this.closePanel();
    this.renderAll();

    // 预算预警
    const b = Store.budgetState(U.monthOf(payload.date));
    if (payload.type === 'expense' && b.set) {
      if (b.level === 'over') {
        setTimeout(() => {
          FX.toast('本月已超支 ' + U.money(b.over), 'error');
          Loader.play('fail');
          FX.shake();
        }, 500);
      } else if (b.level === 'warn') {
        setTimeout(() => FX.toast('预算即将用完，剩 ' + U.money(b.left)), 500);
      }
    }

    // 里程碑
    if (streak && streak.milestone) {
      setTimeout(() => UI.milestoneModal(streak.milestone), 900);
    }
  },

  /* ================= 预算 ================= */
  setBudgetDialog() {
    const cur = Store.getBudget(this.month);
    UI.prompt({
      title: U.monthLabel(this.month) + '预算', label: '月总预算（填 0 表示取消预算）',
      type: 'number', value: cur > 0 ? cur : '', placeholder: '例如 3000'
    }, (v) => {
      const n = Number(v);
      if (v === '' || isNaN(n) || n < 0) { FX.toast('请输入有效金额', 'error'); Loader.play('fail'); return; }
      if (n > CONFIG.MAX_AMOUNT) { FX.toast('预算超出上限', 'error'); return; }
      Store.setBudget(this.month, n);
      FX.toast(n > 0 ? '预算已设为 ' + U.money(n) : '已取消本月预算');
      this.renderBill();
    });
  },

  /* ================= 图表页 ================= */
  renderChart() {
    U.$('#cMonthLabel').textContent = U.monthLabel(this.chartMonth);
    const body = U.$('#chartBody');
    const data = Store.byCategory(this.chartMonth, this.chartType);
    const typeName = this.chartType === 'expense' ? '支出' : '收入';

    if (data.list.length === 0) {
      body.innerHTML = UI.emptyHtml(U.monthLabel(this.chartMonth) + '还没有' + typeName + '记录', '去记一笔', 'add');
      Input.delegate(body, '[data-empty-act]', () => this.openPanel());
      return;
    }

    let html = '<div class="chart-card"><div class="chart-title">' + typeName + '分类占比</div>' +
      '<div class="donut-wrap"><canvas id="donutCanvas"></canvas></div><div class="legend">';
    data.list.forEach((it, i) => {
      const color = CONFIG.CHART_COLORS[i % CONFIG.CHART_COLORS.length];
      html += '<div class="legend-item" data-drill="' + it.id + '">' +
        '<span class="legend-dot" style="background:' + color + '"></span>' +
        '<span class="legend-name">' + it.emoji + ' ' + U.esc(it.name) + '</span>' +
        '<span class="legend-ratio">' + (it.ratio * 100).toFixed(1) + '% · ' + it.count + '笔</span>' +
        '<span class="legend-amt">' + this.priv(U.money(it.amount)) + '</span></div>';
    });
    html += '</div></div>';

    html += '<div class="chart-card"><div class="chart-title">近 ' + CONFIG.TREND_MONTHS + ' 月收支趋势</div>' +
      '<div style="font-size:22px;color:#8A9099;margin-bottom:8px">🔴 柱＝支出　🟢 线＝收入</div>' +
      '<div class="canvas-scroll"><canvas id="trendCanvas"></canvas></div></div>';

    if (this.chartType === 'expense') {
      const top = data.list.slice(0, CONFIG.RANK_TOP_N);
      const max = top.length ? top[0].amount : 1;
      html += '<div class="chart-card"><div class="chart-title">支出 TOP' + top.length + '</div>';
      top.forEach((it, i) => {
        const color = CONFIG.CHART_COLORS[i % CONFIG.CHART_COLORS.length];
        html += '<div class="rank-item" data-drill="' + it.id + '"><div class="rank-top">' +
          '<span>' + (i + 1) + '. ' + it.emoji + ' ' + U.esc(it.name) + '</span>' +
          '<b>' + this.priv(U.money(it.amount)) + '</b></div>' +
          '<div class="rank-bar"><div class="rank-fill" style="width:' + Math.max(4, (it.amount / max) * 100) + '%;background:' + color + '"></div></div></div>';
      });
      html += '</div>';
    }

    body.innerHTML = html;

    const dc = U.$('#donutCanvas');
    this.donutHit = Charts.donut(dc, data.list, typeName + '合计', Store.meta().privacy ? '****' : U.money(data.sum));
    dc.addEventListener('click', (e) => {
      const r = dc.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * this.donutHit.w;
      const y = (e.clientY - r.top) / r.height * this.donutHit.h;
      const id = Charts.hitDonut(this.donutHit, x, y);
      if (id) this.drillCategory(id);
    });

    Charts.trend(U.$('#trendCanvas'), Store.trend(this.chartMonth));
  },

  drillCategory(catId) {
    const list = Store.bookRecords(this.chartMonth).filter((r) => r.categoryId === catId && r.type === this.chartType);
    const c = Store.category(catId);
    let html = '<h3>' + (c ? c.emoji + ' ' + U.esc(c.name) : '未分类') + '　' + U.monthLabel(this.chartMonth) + '</h3>' +
      '<p>共 ' + list.length + ' 笔，合计 ' + U.money(list.reduce((s, r) => s + r.amount, 0)) + '</p><div class="opt-list">';
    list.forEach((r) => {
      const a = Store.account(r.accountId);
      html += '<div class="opt"><span class="grow">' + r.date.slice(5) + '　' +
        U.esc(r.remark || (a ? a.name : '')) + '</span><b>' + U.money(r.amount) + '</b></div>';
    });
    if (!list.length) html += '<div class="opt"><span class="grow">暂无记录</span></div>';
    html += '</div><div class="modal-btns"><button class="btn-ghost" data-no>关闭</button></div>';
    const box = UI.open(html);
    Input.tap(U.$('[data-no]', box), () => UI.closeModal());
  },

  /* ================= 资产页 ================= */
  renderAsset() {
    const body = U.$('#assetBody');
    const accs = Store.accounts();
    const total = Store.totalAsset();
    const priv = Store.meta().privacy;
    U.$('#privacyToggle').textContent = priv ? '👁 显示金额' : '👁 隐藏金额';

    let html = '<div class="asset-total" data-privacy><div class="lbl">总资产（点击' + (priv ? '显示' : '隐藏') + '）</div>' +
      '<div class="num">' + (priv ? '****' : U.money(total)) + '</div></div>';

    if (accs.length === 0) {
      html += UI.emptyHtml('还没有账户，先添加一个吧', '添加账户', '');
    } else {
      const absSum = accs.reduce((s, a) => s + Math.abs(a.balance), 0);
      html += '<div class="group">';
      accs.forEach((a) => {
        const ratio = absSum > 0 ? Math.abs(a.balance) / absSum * 100 : 0;
        html += '<div class="acc-item" data-acc-edit="' + a.id + '">' +
          '<div class="acc-ico">' + a.emoji + '</div>' +
          '<div class="acc-main"><div class="acc-name">' + U.esc(a.name) + '</div>' +
          '<div class="acc-ratio">占比 ' + ratio.toFixed(1) + '%</div></div>' +
          '<div class="acc-bal' + (a.balance < 0 ? ' neg' : '') + '">' + (priv ? '****' : U.money(a.balance)) + '</div></div>';
      });
      html += '</div>';
    }
    html += '<div class="act-row"><button class="btn-mini ghost" data-acc-add>＋ 添加账户</button>' +
      '<button class="btn-mini" data-transfer>⇄ 转账</button></div>' +
      '<div style="font-size:22px;color:#8A9099;padding:20px 8px;line-height:1.6">提示：账户余额由你手工维护，记账时选择账户会自动加减；转账不计入收支统计。</div>';
    body.innerHTML = html;
  },

  togglePrivacy() {
    const m = Store.meta();
    m.privacy = !m.privacy;
    Store.save();
    FX.toast(m.privacy ? '金额已隐藏' : '金额已显示');
    this.renderBill();
    this.renderAsset();
    if (this.tab === 'chart') this.renderChart();
    if (this.tab === 'mine') this.renderMine();
  },

  accountDialog(id) {
    const a = id ? Store.account(id) : null;
    if (id && !a) { FX.toast('账户不存在', 'error'); return; }
    const state = { emoji: a ? a.emoji : '💳' };
    let html = '<h3>' + (a ? '编辑账户' : '添加账户') + '</h3>' +
      '<div class="field"><label>账户名称（最多 ' + CONFIG.ACCOUNT_NAME_MAX + ' 字）</label>' +
      '<input id="accName" maxlength="' + CONFIG.ACCOUNT_NAME_MAX + '" value="' + U.esc(a ? a.name : '') + '" placeholder="例如 招行卡"></div>' +
      '<div class="field"><label>余额（可为负，如信用卡欠款）</label>' +
      '<input id="accBal" type="number" step="0.01" inputmode="decimal" value="' + (a ? a.balance : 0) + '"></div>' +
      UI.emojiPickHtml(state.emoji) +
      '<div class="modal-btns"><button class="btn-ghost" data-no>取消</button>' +
      (a ? '<button class="btn-danger" data-del>删除</button>' : '') +
      '<button class="btn-primary" data-yes>保存</button></div>';
    const box = UI.open(html);
    UI.bindEmojiPick(box, state);
    Input.tap(U.$('[data-no]', box), () => UI.closeModal());
    Input.tap(U.$('[data-yes]', box), () => {
      const name = U.$('#accName', box).value.trim();
      const bal = Number(U.$('#accBal', box).value);
      if (!name) { FX.toast('请输入账户名称', 'error'); return; }
      if (isNaN(bal) || Math.abs(bal) > CONFIG.MAX_AMOUNT) { FX.toast('余额数值不合法', 'error'); return; }
      if (a) Store.updateAccount(id, { name: name, emoji: state.emoji, balance: bal });
      else {
        const res = Store.addAccount(name, state.emoji, bal);
        if (!res.ok) { FX.toast(res.msg, 'error'); return; }
      }
      UI.closeModal();
      FX.toast('已保存');
      this.renderAsset();
      this.renderBill();
    });
    if (a) {
      Input.tap(U.$('[data-del]', box), () => {
        UI.closeModal();
        UI.confirm('删除账户？', '仅无流水的账户可删除。', () => {
          const res = Store.deleteAccount(id);
          if (!res.ok) { FX.toast(res.msg, 'error'); Loader.play('fail'); return; }
          FX.toast('账户已删除');
          this.renderAsset();
        }, true);
      });
    }
  },

  /* ================= 我的页 ================= */
  renderMine() {
    const m = Store.meta();
    const total = Store.data.records.length;
    const html =
      '<div class="group-title">账本与分类</div><div class="group">' +
      '<div class="row" data-mine="books"><span class="ico">📒</span><span class="label">账本管理</span><span class="val">' + Store.books().length + ' 个</span><span class="arrow">›</span></div>' +
      '<div class="row" data-mine="cats"><span class="ico">🏷</span><span class="label">分类管理</span><span class="val">支出 ' + Store.categories('expense').length + ' / 收入 ' + Store.categories('income').length + '</span><span class="arrow">›</span></div>' +
      '<div class="row" data-mine="budget"><span class="ico">🎯</span><span class="label">预算设置</span><span class="val">' + (Store.getBudget(U.monthStr()) > 0 ? U.money(Store.getBudget(U.monthStr())) : '未设置') + '</span><span class="arrow">›</span></div>' +
      '</div>' +
      '<div class="group-title">数据</div><div class="group">' +
      '<div class="row" data-mine="csv"><span class="ico">📄</span><span class="label">导出 CSV（Excel 可开）</span><span class="arrow">›</span></div>' +
      '<div class="row" data-mine="json"><span class="ico">💾</span><span class="label">导出 JSON 备份</span><span class="arrow">›</span></div>' +
      '<div class="row" data-mine="import"><span class="ico">📥</span><span class="label">导入 JSON 恢复</span><span class="arrow">›</span></div>' +
      '<div class="row" data-mine="report"><span class="ico">🏅</span><span class="label">查看上月月报</span><span class="arrow">›</span></div>' +
      '<div class="row danger" data-mine="clear"><span class="ico">🗑</span><span class="label">清空所有数据</span><span class="val">' + total + ' 条流水</span><span class="arrow">›</span></div>' +
      '</div>' +
      '<div class="group-title">偏好</div><div class="group">' +
      '<div class="row" data-mine="privacy"><span class="ico">👁</span><span class="label">隐私模式（隐藏金额）</span><div class="switch ' + (m.privacy ? 'on' : '') + '"></div></div>' +
      '<div class="row" data-mine="sound"><span class="ico">🔔</span><span class="label">音效</span><div class="switch ' + (m.soundOn !== false ? 'on' : '') + '"></div></div>' +
      '<div class="row" data-mine="guide"><span class="ico">🧭</span><span class="label">重看新手引导</span><span class="arrow">›</span></div>' +
      '</div>' +
      '<div class="group-title">关于</div>' +
      '<div class="about-text">' + CONFIG.APP_NAME + ' · 纯本地记账工具<br>' +
      '所有数据只保存在你自己的浏览器里，不上传、不联网。建议定期用「导出 JSON 备份」保存一份，换设备或清缓存前尤其重要。<br>' +
      '当前共 ' + total + ' 条流水，上限 ' + CONFIG.MAX_RECORDS + ' 条。</div>';
    U.$('#mineBody').innerHTML = html;
  },

  mineAction(act) {
    switch (act) {
      case 'books': this.bookManage(); break;
      case 'cats': this.catManage('expense'); break;
      case 'budget': this.setBudgetDialog(); break;
      case 'csv': this.exportCSV(); break;
      case 'json': this.exportJSON(); break;
      case 'import': this.importDialog(); break;
      case 'report': {
        const last = U.shiftMonth(U.monthStr(), -1);
        const rep = Store.monthReport(last);
        if (rep.count === 0) { UI.alert('暂无月报', U.monthLabel(last) + '没有记账记录，先记几笔再来看吧～'); return; }
        UI.reportModal(rep);
        break;
      }
      case 'clear':
        UI.confirm('清空所有数据？', '所有账本、流水、预算与账户余额都会被重置，建议先导出备份。此操作无法撤销。', () => {
          Store.clearAll();
          this.month = U.monthStr();
          this.chartMonth = this.month;
          FX.toast('数据已清空');
          this.renderAll();
          this.renderMine();
        }, true);
        break;
      case 'privacy': this.togglePrivacy(); break;
      case 'sound': {
        const m = Store.meta();
        m.soundOn = m.soundOn === false;
        Loader.soundOn = m.soundOn;
        Store.save();
        if (m.soundOn) Loader.play('success');
        FX.toast(m.soundOn ? '音效已开启' : '音效已关闭');
        this.renderMine();
        break;
      }
      case 'guide':
        Store.meta().guideDone = false;
        Store.save();
        this.switchTab('bill');
        setTimeout(() => UI.guide(), 200);
        break;
    }
  },

  /* ---- 账本管理 ---- */
  bookManage() {
    const books = Store.books();
    const cur = Store.meta().currentBookId;
    let html = '<h3>账本管理</h3><div class="opt-list">';
    books.forEach((b) => {
      const cnt = Store.data.records.filter((r) => r.bookId === b.id).length;
      html += '<div class="opt' + (b.id === cur ? ' sel' : '') + '"><span>' + b.icon + '</span>' +
        '<span class="grow">' + U.esc(b.name) + ' <span style="color:#8A9099;font-size:21px">' + cnt + ' 笔</span></span>' +
        '<button class="mini" data-switch="' + b.id + '">' + (b.id === cur ? '使用中' : '切换') + '</button>' +
        '<button class="mini" data-rename="' + b.id + '">改名</button>' +
        (books.length > 1 ? '<button class="mini del" data-delbook="' + b.id + '">删</button>' : '') +
        '</div>';
    });
    html += '</div><div class="modal-btns"><button class="btn-ghost" data-no>关闭</button>' +
      '<button class="btn-primary" data-add>＋ 新建账本</button></div>';
    const box = UI.open(html);
    Input.tap(U.$('[data-no]', box), () => UI.closeModal());
    Input.tap(U.$('[data-add]', box), () => {
      UI.closeModal();
      UI.prompt({ title: '新建账本', label: '账本名称（最多 ' + CONFIG.BOOK_NAME_MAX + ' 字）', maxlength: CONFIG.BOOK_NAME_MAX, placeholder: '例如 旅行账本' }, (v) => {
        const icon = CONFIG.BOOK_ICONS[Store.books().length % CONFIG.BOOK_ICONS.length];
        const res = Store.addBook(v, icon);
        if (!res.ok) { FX.toast(res.msg, 'error'); Loader.play('fail'); return; }
        FX.toast('账本「' + res.book.name + '」已创建');
        this.renderMine();
        this.bookManage();
      });
    });
    Input.delegate(box, '[data-switch]', (t) => {
      Store.switchBook(t.getAttribute('data-switch'));
      UI.closeModal();
      this.month = U.monthStr();
      this.chartMonth = this.month;
      this.openedRecId = '';
      FX.toast('已切换到「' + Store.currentBook().name + '」');
      this.renderAll();
      this.renderMine();
    });
    Input.delegate(box, '[data-rename]', (t) => {
      const id = t.getAttribute('data-rename');
      const b = Store.books().find((x) => x.id === id);
      UI.closeModal();
      UI.prompt({ title: '重命名账本', label: '新名称', value: b ? b.name : '', maxlength: CONFIG.BOOK_NAME_MAX }, (v) => {
        if (!Store.renameBook(id, v)) { FX.toast('名称不能为空', 'error'); return; }
        FX.toast('已重命名');
        this.renderAll();
        this.bookManage();
      });
    });
    Input.delegate(box, '[data-delbook]', (t) => {
      const id = t.getAttribute('data-delbook');
      UI.closeModal();
      UI.confirm('删除账本？', '该账本下的所有流水会一并删除，账户余额将回滚。此操作无法撤销。', () => {
        const res = Store.deleteBook(id);
        if (!res.ok) { FX.toast(res.msg, 'error'); Loader.play('fail'); return; }
        FX.toast('账本已删除');
        this.renderAll();
        this.renderMine();
      }, true);
    });
  },

  /* ---- 分类管理 ---- */
  catManage(type) {
    const list = Store.categories(type);
    let html = '<h3>分类管理</h3>' +
      '<div style="display:flex;justify-content:center;margin-bottom:16px"><div class="seg small">' +
      '<button class="seg-btn ' + (type === 'expense' ? 'active' : '') + '" data-ctab="expense">支出</button>' +
      '<button class="seg-btn ' + (type === 'income' ? 'active' : '') + '" data-ctab="income">收入</button>' +
      '</div></div><div class="opt-list">';
    list.forEach((c, i) => {
      const used = Store.data.records.filter((r) => r.categoryId === c.id).length;
      html += '<div class="opt"><span>' + c.emoji + '</span>' +
        '<span class="grow">' + U.esc(c.name) + ' <span style="color:#8A9099;font-size:20px">' + used + ' 笔</span></span>' +
        '<button class="mini" data-cup="' + c.id + '" ' + (i === 0 ? 'disabled style="opacity:.35"' : '') + '>↑</button>' +
        '<button class="mini" data-cdown="' + c.id + '" ' + (i === list.length - 1 ? 'disabled style="opacity:.35"' : '') + '>↓</button>' +
        '<button class="mini" data-cedit="' + c.id + '">改</button>' +
        '<button class="mini del" data-cdel="' + c.id + '">删</button></div>';
    });
    html += '</div><div class="modal-btns"><button class="btn-ghost" data-no>关闭</button>' +
      '<button class="btn-primary" data-cadd="' + type + '">＋ 新增分类</button></div>';
    const box = UI.open(html);
    Input.tap(U.$('[data-no]', box), () => UI.closeModal());
    Input.delegate(box, '[data-ctab]', (t) => { UI.closeModal(); this.catManage(t.getAttribute('data-ctab')); });
    Input.delegate(box, '[data-cup]', (t) => { Store.moveCategory(t.getAttribute('data-cup'), -1); UI.closeModal(); this.catManage(type); });
    Input.delegate(box, '[data-cdown]', (t) => { Store.moveCategory(t.getAttribute('data-cdown'), 1); UI.closeModal(); this.catManage(type); });
    Input.delegate(box, '[data-cadd]', () => { UI.closeModal(); this.catEditDialog(type, ''); });
    Input.delegate(box, '[data-cedit]', (t) => { UI.closeModal(); this.catEditDialog(type, t.getAttribute('data-cedit')); });
    Input.delegate(box, '[data-cdel]', (t) => {
      const id = t.getAttribute('data-cdel');
      UI.closeModal();
      UI.confirm('删除分类？', '该分类下的历史流水会自动归入「其他」分类。', () => {
        const res = Store.deleteCategory(id);
        if (!res.ok) { FX.toast(res.msg, 'error'); Loader.play('fail'); return; }
        FX.toast('已删除，历史流水归入「' + res.fallback + '」');
        this.renderAll();
        this.catManage(type);
      }, true);
    });
  },

  catEditDialog(type, id) {
    const c = id ? Store.category(id) : null;
    const state = { emoji: c ? c.emoji : '💸' };
    let html = '<h3>' + (c ? '编辑分类' : '新增' + (type === 'expense' ? '支出' : '收入') + '分类') + '</h3>' +
      '<div class="field"><label>分类名称（最多 ' + CONFIG.CATEGORY_NAME_MAX + ' 字）</label>' +
      '<input id="catName" maxlength="' + CONFIG.CATEGORY_NAME_MAX + '" value="' + U.esc(c ? c.name : '') + '" placeholder="例如 咖啡"></div>' +
      (type === 'expense' ? '<div class="field"><label>该分类月预算（0 表示不限制）</label>' +
        '<input id="catBudget" type="number" step="0.01" inputmode="decimal" value="' + (c && c.budget ? c.budget : 0) + '"></div>' : '') +
      UI.emojiPickHtml(state.emoji) +
      '<div class="modal-btns"><button class="btn-ghost" data-no>取消</button><button class="btn-primary" data-yes>保存</button></div>';
    const box = UI.open(html);
    UI.bindEmojiPick(box, state);
    Input.tap(U.$('[data-no]', box), () => { UI.closeModal(); this.catManage(type); });
    Input.tap(U.$('[data-yes]', box), () => {
      const name = U.$('#catName', box).value.trim();
      if (!name) { FX.toast('请输入分类名称', 'error'); return; }
      const bInput = U.$('#catBudget', box);
      const budget = bInput ? Number(bInput.value) || 0 : 0;
      if (c) Store.updateCategory(id, { name: name, emoji: state.emoji, budget: budget });
      else {
        const res = Store.addCategory(type, name, state.emoji);
        if (!res.ok) { FX.toast(res.msg, 'error'); Loader.play('fail'); return; }
        if (budget > 0) Store.updateCategory(res.category.id, { budget: budget });
      }
      UI.closeModal();
      FX.toast('已保存');
      this.renderAll();
      this.catManage(type);
    });
  },

  /* ---- 导入导出 ---- */
  exportCSV() {
    const csv = Store.exportCSV(false);
    const name = '鲨鱼小账本_' + Store.currentBook().name + '_' + U.todayStr() + '.csv';
    if (U.download(name, csv, 'text/csv;charset=utf-8')) FX.toast('CSV 已开始下载');
    else UI.alert('导出失败', '当前浏览器不支持文件下载，请换用其他浏览器再试。');
  },

  exportJSON() {
    const json = Store.exportJSON();
    const name = '鲨鱼小账本_备份_' + U.todayStr() + '.json';
    if (U.download(name, json, 'application/json')) FX.toast('JSON 备份已开始下载');
    else UI.alert('导出失败', '当前浏览器不支持文件下载，请换用其他浏览器再试。');
  },

  importDialog() {
    const box = UI.open(
      '<h3>导入 JSON 恢复</h3><p>选择之前导出的 JSON 备份文件。导入会<b>覆盖</b>当前所有数据，请先确认已备份。</p>' +
      '<div class="field"><input type="file" id="importFile" accept=".json,application/json"></div>' +
      '<div class="modal-btns"><button class="btn-ghost" data-no>取消</button><button class="btn-danger" data-yes>确认导入</button></div>'
    );
    Input.tap(U.$('[data-no]', box), () => UI.closeModal());
    Input.tap(U.$('[data-yes]', box), () => {
      const f = U.$('#importFile', box).files[0];
      if (!f) { FX.toast('请先选择文件', 'error'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const res = Store.importJSON(String(reader.result));
        UI.closeModal();
        if (!res.ok) { UI.alert('导入失败', res.msg); Loader.play('fail'); return; }
        this.month = U.monthStr();
        this.chartMonth = this.month;
        FX.toast('导入成功，共 ' + res.count + ' 条流水', 'success');
        Loader.play('success');
        this.renderAll();
        this.renderMine();
      };
      reader.onerror = () => { UI.closeModal(); UI.alert('导入失败', '文件读取出错，请重试。'); };
      reader.readAsText(f);
    });
  },

  /* 账本快捷切换 */
  bookPicker() {
    const items = Store.books().map((b) => ({
      id: b.id, label: b.name, emoji: b.icon,
      sub: Store.data.records.filter((r) => r.bookId === b.id).length + ' 笔'
    }));
    UI.picker('切换账本', items, Store.meta().currentBookId, (id) => {
      Store.switchBook(id);
      this.month = U.monthStr();
      this.chartMonth = this.month;
      this.openedRecId = '';
      FX.toast('已切换到「' + Store.currentBook().name + '」');
      this.renderAll();
    }, '<div style="text-align:center;font-size:22px;color:#8A9099;padding:8px 0">更多操作见「我的 - 账本管理」</div>');
  }
};

/* 跨天/跨月回到前台时重算上下文 */
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !Store.data) return;
  const now = U.monthStr();
  App.checkMonthReport();
  if (App.month !== now && App.tab === 'bill') {
    // 若之前停留在其他月份则不强行跳转，只刷新数据
    App.renderBill();
  } else {
    App.renderBill();
  }
});

window.addEventListener('load', () => App.boot());
