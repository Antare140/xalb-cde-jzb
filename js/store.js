/* 数据层：localStorage 持久化 + 校验 + CRUD + 统计 */
const Store = {
  data: null,
  memoryMode: false,      // localStorage 不可用时降级
  storageWarn: '',

  /* ---------- 初始化 ---------- */
  defaultData() {
    const bookId = U.uid('bk');
    const cats = [];
    CONFIG.DEFAULT_EXPENSE.forEach((c, i) => {
      cats.push({ id: U.uid('ct'), type: 'expense', name: c[0], emoji: c[1], order: i, budget: 0 });
    });
    CONFIG.DEFAULT_INCOME.forEach((c, i) => {
      cats.push({ id: U.uid('ct'), type: 'income', name: c[0], emoji: c[1], order: i, budget: 0 });
    });
    const accounts = CONFIG.DEFAULT_ACCOUNTS.map((a) => ({ id: U.uid('ac'), name: a[0], emoji: a[1], balance: 0 }));
    const firstCat = cats[0];
    const demoId = U.uid('rc');
    return {
      version: CONFIG.VERSION,
      books: [{ id: bookId, name: CONFIG.DEFAULT_BOOK_NAME, icon: '📒', createdAt: Date.now() }],
      categories: cats,
      accounts: accounts,
      records: [{
        id: demoId, bookId: bookId, type: 'expense', amount: 28,
        categoryId: firstCat.id, accountId: accounts[0].id, remark: '午餐',
        date: U.todayStr(), createdAt: Date.now(), demo: true
      }],
      budgets: [],
      meta: {
        currentBookId: bookId,
        lastCategoryId: firstCat.id,
        lastAccountId: accounts[0].id,
        streak: 0,
        lastRecordDate: '',
        lastReportMonth: U.monthStr(),
        guideDone: false,
        privacy: false,
        soundOn: true,
        milestones: []
      }
    };
  },

  init() {
    let raw = null;
    try {
      raw = window.localStorage.getItem(CONFIG.STORAGE_KEY);
    } catch (e) {
      this.memoryMode = true;
      this.storageWarn = '当前浏览器无法保存数据，请及时导出备份';
    }
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (this.validate(parsed)) {
          this.data = this.migrate(parsed);
        } else {
          throw new Error('结构校验失败');
        }
      } catch (e) {
        try { window.localStorage.setItem(CONFIG.BACKUP_KEY, raw); } catch (e2) { /* 忽略 */ }
        this.data = this.defaultData();
        this.storageWarn = '本地数据损坏，已备份并以新账本启动';
      }
    } else {
      this.data = this.defaultData();
      this.save();
    }
    Loader.soundOn = this.data.meta.soundOn !== false;
    return this.data;
  },

  validate(d) {
    if (!d || typeof d !== 'object') return false;
    if (!Array.isArray(d.books) || !Array.isArray(d.categories)) return false;
    if (!Array.isArray(d.accounts) || !Array.isArray(d.records)) return false;
    if (!d.meta || typeof d.meta !== 'object') return false;
    if (d.books.length === 0 || d.categories.length === 0) return false;
    return true;
  },

  migrate(d) {
    d.version = CONFIG.VERSION;
    d.budgets = Array.isArray(d.budgets) ? d.budgets : [];
    const m = d.meta;
    if (!m.currentBookId || !d.books.some((b) => b.id === m.currentBookId)) m.currentBookId = d.books[0].id;
    if (typeof m.streak !== 'number') m.streak = 0;
    if (!Array.isArray(m.milestones)) m.milestones = [];
    if (!m.lastReportMonth) m.lastReportMonth = U.monthStr();
    d.records = d.records.filter((r) => r && r.id && typeof r.amount === 'number' && r.date);
    return d;
  },

  _doSave() {
    if (this.memoryMode) return;
    try {
      window.localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      this.memoryMode = true;
      const quota = e && (e.name === 'QuotaExceededError' || e.code === 22);
      this.storageWarn = quota ? '存储空间已满，请导出备份并清理旧数据' : '数据保存失败，请导出备份';
      if (typeof App !== 'undefined' && App.renderStorageWarn) App.renderStorageWarn();
    }
  },

  save() {
    if (!this._debounced) this._debounced = U.debounce(() => this._doSave(), CONFIG.SAVE_DEBOUNCE_MS);
    this._debounced();
  },

  /* ---------- 基础访问 ---------- */
  meta() { return this.data.meta; },
  books() { return this.data.books; },
  accounts() { return this.data.accounts; },
  currentBook() {
    return this.data.books.find((b) => b.id === this.data.meta.currentBookId) || this.data.books[0];
  },
  categories(type) {
    return this.data.categories
      .filter((c) => c.type === type)
      .sort((a, b) => a.order - b.order);
  },
  category(id) { return this.data.categories.find((c) => c.id === id) || null; },
  account(id) { return this.data.accounts.find((a) => a.id === id) || null; },
  record(id) { return this.data.records.find((r) => r.id === id) || null; },

  bookRecords(month) {
    const bid = this.data.meta.currentBookId;
    let list = this.data.records.filter((r) => r.bookId === bid);
    if (month) list = list.filter((r) => U.monthOf(r.date) === month);
    return list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  },

  /* ---------- 流水 CRUD ---------- */
  addRecord(rec) {
    if (this.data.records.length >= CONFIG.MAX_RECORDS) {
      return { ok: false, msg: '流水已达上限，请导出归档后再记' };
    }
    const r = {
      id: U.uid('rc'),
      bookId: this.data.meta.currentBookId,
      type: rec.type,
      amount: U.round2(rec.amount),
      categoryId: rec.categoryId || '',
      accountId: rec.accountId || '',
      toAccountId: rec.toAccountId || '',
      remark: String(rec.remark || '').trim().slice(0, CONFIG.REMARK_MAX_LEN),
      date: rec.date,
      createdAt: Date.now()
    };
    this.data.records.push(r);
    this.applyBalance(r, 1);
    if (rec.type !== 'transfer' && r.categoryId) this.data.meta.lastCategoryId = r.categoryId;
    if (r.accountId) this.data.meta.lastAccountId = r.accountId;
    const streakInfo = this.touchStreak(r.date);
    this.save();
    return { ok: true, record: r, streak: streakInfo };
  },

  updateRecord(id, patch) {
    const r = this.record(id);
    if (!r) return { ok: false, msg: '该记录已不存在' };
    this.applyBalance(r, -1);
    r.type = patch.type;
    r.amount = U.round2(patch.amount);
    r.categoryId = patch.categoryId || '';
    r.accountId = patch.accountId || '';
    r.toAccountId = patch.toAccountId || '';
    r.remark = String(patch.remark || '').trim().slice(0, CONFIG.REMARK_MAX_LEN);
    r.date = patch.date;
    delete r.demo;
    this.applyBalance(r, 1);
    this.save();
    return { ok: true, record: r };
  },

  deleteRecord(id) {
    const idx = this.data.records.findIndex((r) => r.id === id);
    if (idx < 0) return false;
    this.applyBalance(this.data.records[idx], -1);
    this.data.records.splice(idx, 1);
    this.save();
    return true;
  },

  clearDemo() {
    this.data.records = this.data.records.filter((r) => {
      if (r.demo) { this.applyBalance(r, -1); return false; }
      return true;
    });
    this.save();
  },

  hasDemo() { return this.data.records.some((r) => r.demo); },

  /* 账户余额联动，sign=1 应用 / -1 回滚 */
  applyBalance(r, sign) {
    const from = this.account(r.accountId);
    if (r.type === 'expense' && from) from.balance = U.round2(from.balance - sign * r.amount);
    else if (r.type === 'income' && from) from.balance = U.round2(from.balance + sign * r.amount);
    else if (r.type === 'transfer') {
      const to = this.account(r.toAccountId);
      if (from) from.balance = U.round2(from.balance - sign * r.amount);
      if (to) to.balance = U.round2(to.balance + sign * r.amount);
    }
  },

  /* ---------- 连续记账 ---------- */
  touchStreak(date) {
    const m = this.data.meta;
    const today = U.todayStr();
    if (date !== today) return { changed: false, streak: m.streak, milestone: 0 };
    if (m.lastRecordDate === today) return { changed: false, streak: m.streak, milestone: 0 };
    if (m.lastRecordDate && U.dayDiff(today, m.lastRecordDate) === 1) m.streak = (m.streak || 0) + 1;
    else m.streak = 1;
    m.lastRecordDate = today;
    let milestone = 0;
    if (CONFIG.STREAK_MILESTONES.indexOf(m.streak) >= 0 && m.milestones.indexOf(m.streak) < 0) {
      milestone = m.streak;
      m.milestones.push(m.streak);
    }
    return { changed: true, streak: m.streak, milestone: milestone };
  },

  /* ---------- 账本 ---------- */
  addBook(name, icon) {
    if (this.data.books.length >= CONFIG.MAX_BOOKS) return { ok: false, msg: '账本数量已达上限 ' + CONFIG.MAX_BOOKS };
    name = String(name || '').trim().slice(0, CONFIG.BOOK_NAME_MAX);
    if (!name) return { ok: false, msg: '请输入账本名称' };
    const b = { id: U.uid('bk'), name: name, icon: icon || '📒', createdAt: Date.now() };
    this.data.books.push(b);
    this.save();
    return { ok: true, book: b };
  },
  renameBook(id, name) {
    const b = this.data.books.find((x) => x.id === id);
    if (!b) return false;
    name = String(name || '').trim().slice(0, CONFIG.BOOK_NAME_MAX);
    if (!name) return false;
    b.name = name; this.save(); return true;
  },
  deleteBook(id) {
    if (this.data.books.length <= 1) return { ok: false, msg: '至少保留一个账本' };
    this.data.records = this.data.records.filter((r) => {
      if (r.bookId === id) { this.applyBalance(r, -1); return false; }
      return true;
    });
    this.data.books = this.data.books.filter((b) => b.id !== id);
    this.data.budgets = this.data.budgets.filter((b) => b.bookId !== id);
    if (this.data.meta.currentBookId === id) this.data.meta.currentBookId = this.data.books[0].id;
    this.save();
    return { ok: true };
  },
  switchBook(id) {
    if (!this.data.books.some((b) => b.id === id)) return false;
    this.data.meta.currentBookId = id;
    this.save();
    return true;
  },

  /* ---------- 分类 ---------- */
  addCategory(type, name, emoji) {
    const list = this.categories(type);
    if (list.length >= CONFIG.MAX_CATEGORIES) return { ok: false, msg: '分类数量已达上限 ' + CONFIG.MAX_CATEGORIES };
    name = String(name || '').trim().slice(0, CONFIG.CATEGORY_NAME_MAX);
    if (!name) return { ok: false, msg: '请输入分类名称' };
    const c = { id: U.uid('ct'), type: type, name: name, emoji: emoji || '💸', order: list.length, budget: 0 };
    this.data.categories.push(c);
    this.save();
    return { ok: true, category: c };
  },
  updateCategory(id, patch) {
    const c = this.category(id);
    if (!c) return false;
    if (patch.name != null) {
      const n = String(patch.name).trim().slice(0, CONFIG.CATEGORY_NAME_MAX);
      if (n) c.name = n;
    }
    if (patch.emoji) c.emoji = patch.emoji;
    if (patch.budget != null) c.budget = Math.max(0, U.round2(patch.budget));
    this.save();
    return true;
  },
  deleteCategory(id) {
    const c = this.category(id);
    if (!c) return { ok: false, msg: '分类不存在' };
    const list = this.categories(c.type);
    if (list.length <= 1) return { ok: false, msg: '至少保留一个分类' };
    let fallback = list.filter((x) => x.id !== id).find((x) => x.name === '其他');
    if (!fallback) fallback = list.filter((x) => x.id !== id)[0];
    this.data.records.forEach((r) => { if (r.categoryId === id) r.categoryId = fallback.id; });
    this.data.categories = this.data.categories.filter((x) => x.id !== id);
    if (this.data.meta.lastCategoryId === id) this.data.meta.lastCategoryId = fallback.id;
    this.save();
    return { ok: true, fallback: fallback.name };
  },
  moveCategory(id, dir) {
    const c = this.category(id);
    if (!c) return false;
    const list = this.categories(c.type);
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return false;
    const o = list[i].order; list[i].order = list[j].order; list[j].order = o;
    this.save();
    return true;
  },

  /* ---------- 账户 ---------- */
  addAccount(name, emoji, balance) {
    if (this.data.accounts.length >= CONFIG.MAX_ACCOUNTS) return { ok: false, msg: '账户数量已达上限 ' + CONFIG.MAX_ACCOUNTS };
    name = String(name || '').trim().slice(0, CONFIG.ACCOUNT_NAME_MAX);
    if (!name) return { ok: false, msg: '请输入账户名称' };
    const a = { id: U.uid('ac'), name: name, emoji: emoji || '💳', balance: U.round2(balance || 0) };
    this.data.accounts.push(a);
    this.save();
    return { ok: true, account: a };
  },
  updateAccount(id, patch) {
    const a = this.account(id);
    if (!a) return false;
    if (patch.name != null) {
      const n = String(patch.name).trim().slice(0, CONFIG.ACCOUNT_NAME_MAX);
      if (n) a.name = n;
    }
    if (patch.emoji) a.emoji = patch.emoji;
    if (patch.balance != null) a.balance = U.round2(patch.balance);
    this.save();
    return true;
  },
  deleteAccount(id) {
    if (this.data.accounts.length <= 1) return { ok: false, msg: '至少保留一个账户' };
    if (this.data.records.some((r) => r.accountId === id || r.toAccountId === id)) {
      return { ok: false, msg: '该账户已有流水，不能删除' };
    }
    this.data.accounts = this.data.accounts.filter((a) => a.id !== id);
    if (this.data.meta.lastAccountId === id) this.data.meta.lastAccountId = this.data.accounts[0].id;
    this.save();
    return { ok: true };
  },
  totalAsset() {
    return U.round2(this.data.accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0));
  },

  /* ---------- 预算 ---------- */
  getBudget(month) {
    const bid = this.data.meta.currentBookId;
    const b = this.data.budgets.find((x) => x.bookId === bid && x.month === month);
    return b ? Number(b.total) || 0 : 0;
  },
  setBudget(month, total) {
    const bid = this.data.meta.currentBookId;
    total = Math.max(0, U.round2(total));
    let b = this.data.budgets.find((x) => x.bookId === bid && x.month === month);
    if (b) b.total = total;
    else this.data.budgets.push({ bookId: bid, month: month, total: total });
    this.save();
  },

  /* ---------- 统计 ---------- */
  summary(month) {
    const list = this.bookRecords(month);
    let income = 0, expense = 0, count = 0;
    list.forEach((r) => {
      if (r.type === 'income') { income += r.amount; count++; }
      else if (r.type === 'expense') { expense += r.amount; count++; }
    });
    income = U.round2(income); expense = U.round2(expense);
    return { income: income, expense: expense, balance: U.round2(income - expense), count: count, total: list.length };
  },

  budgetState(month) {
    const total = this.getBudget(month);
    const used = this.summary(month).expense;
    if (total <= 0) return { set: false, total: 0, used: used, ratio: 0, level: 'none', left: 0, daily: 0 };
    const ratio = used / total;
    const left = U.round2(Math.max(0, total - used));
    const rest = U.restDaysOfMonth();
    const level = ratio >= CONFIG.BUDGET_OVER_RATIO ? 'over' : (ratio >= CONFIG.BUDGET_WARN_RATIO ? 'warn' : 'safe');
    return {
      set: true, total: total, used: used, ratio: ratio, level: level, left: left,
      over: U.round2(Math.max(0, used - total)),
      daily: month === U.monthStr() && rest > 0 ? U.round2(left / rest) : 0
    };
  },

  byCategory(month, type) {
    const list = this.bookRecords(month).filter((r) => r.type === type);
    const map = {};
    let sum = 0;
    list.forEach((r) => {
      const key = r.categoryId || 'unknown';
      if (!map[key]) map[key] = { id: key, amount: 0, count: 0 };
      map[key].amount = U.round2(map[key].amount + r.amount);
      map[key].count++;
      sum = U.round2(sum + r.amount);
    });
    const arr = Object.keys(map).map((k) => {
      const c = this.category(k);
      return {
        id: k,
        name: c ? c.name : '未分类',
        emoji: c ? c.emoji : '❓',
        amount: map[k].amount,
        count: map[k].count,
        ratio: sum > 0 ? map[k].amount / sum : 0
      };
    });
    arr.sort((a, b) => b.amount - a.amount);
    return { sum: sum, list: arr };
  },

  trend(endMonth, months) {
    months = months || CONFIG.TREND_MONTHS;
    const out = [];
    for (let i = months - 1; i >= 0; i--) {
      const m = U.shiftMonth(endMonth, -i);
      const s = this.summary(m);
      out.push({ month: m, label: Number(m.split('-')[1]) + '月', income: s.income, expense: s.expense });
    }
    return out;
  },

  dayMap(month) {
    const map = {};
    this.bookRecords(month).forEach((r) => {
      const d = Number(r.date.split('-')[2]);
      if (!map[d]) map[d] = { income: 0, expense: 0, count: 0 };
      if (r.type === 'income') map[d].income = U.round2(map[d].income + r.amount);
      else if (r.type === 'expense') map[d].expense = U.round2(map[d].expense + r.amount);
      map[d].count++;
    });
    return map;
  },

  monthReport(month) {
    const s = this.summary(month);
    const cat = this.byCategory(month, 'expense');
    const budget = this.getBudget(month);
    const list = this.bookRecords(month).filter((r) => r.type === 'expense');
    let max = null;
    list.forEach((r) => { if (!max || r.amount > max.amount) max = r; });
    let grade = 'B';
    if (budget > 0 && s.expense > budget) grade = 'C';
    else if (s.count >= CONFIG.REPORT_MIN_COUNT && (budget === 0 || s.expense <= budget)) grade = 'A';
    return {
      month: month, income: s.income, expense: s.expense, balance: s.balance, count: s.count,
      topCategory: cat.list[0] || null,
      maxRecord: max,
      budget: budget,
      over: budget > 0 ? U.round2(Math.max(0, s.expense - budget)) : 0,
      grade: grade
    };
  },

  /* ---------- 导入导出 ---------- */
  exportCSV(allBooks) {
    const rows = [['日期', '账本', '类型', '分类', '账户', '转入账户', '金额', '备注']];
    const typeName = { expense: '支出', income: '收入', transfer: '转账' };
    let list = this.data.records.slice();
    if (!allBooks) list = list.filter((r) => r.bookId === this.data.meta.currentBookId);
    list.sort((a, b) => (a.date < b.date ? 1 : -1));
    list.forEach((r) => {
      const bk = this.data.books.find((b) => b.id === r.bookId);
      const c = this.category(r.categoryId);
      const a = this.account(r.accountId);
      const t = this.account(r.toAccountId);
      rows.push([
        r.date, bk ? bk.name : '', typeName[r.type] || r.type,
        c ? c.name : '', a ? a.name : '', t ? t.name : '',
        r.amount.toFixed(2), String(r.remark || '').replace(/[\r\n]/g, ' ')
      ]);
    });
    const csv = rows.map((row) => row.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    return '\uFEFF' + csv;
  },

  exportJSON() { return JSON.stringify(this.data, null, 2); },

  importJSON(text) {
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { return { ok: false, msg: '文件不是合法的 JSON' }; }
    if (!this.validate(parsed)) return { ok: false, msg: '数据结构不完整（缺少账本/分类/流水字段）' };
    const bad = parsed.records.some((r) => !r || typeof r.amount !== 'number' || !r.date || !r.type);
    if (bad) return { ok: false, msg: '存在流水字段缺失或类型错误，已拒绝导入' };
    this.data = this.migrate(parsed);
    Loader.soundOn = this.data.meta.soundOn !== false;
    this._doSave();
    return { ok: true, count: this.data.records.length };
  },

  clearAll() {
    this.data = this.defaultData();
    this.data.records = [];
    this.data.meta.guideDone = true;
    this._doSave();
  }
};
