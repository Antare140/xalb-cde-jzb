/* 鲨鱼小账本 - 全局配置（所有关键数值集中于此，禁止在逻辑中硬编码） */
const CONFIG = {
  APP_NAME: '鲨鱼小账本',
  VERSION: 1,

  // 画面
  CANVAS_W: 720,
  CANVAS_H: 1440,
  TABBAR_H: 120,

  // 数值边界
  MAX_AMOUNT: 9999999.99,
  MIN_AMOUNT: 0.01,
  AMOUNT_DECIMALS: 2,
  REMARK_MAX_LEN: 30,
  CATEGORY_NAME_MAX: 6,
  BOOK_NAME_MAX: 8,
  ACCOUNT_NAME_MAX: 6,
  MAX_BOOKS: 10,
  MAX_ACCOUNTS: 12,
  MAX_CATEGORIES: 30,
  MAX_RECORDS: 5000,

  // 预算
  BUDGET_WARN_RATIO: 0.7,
  BUDGET_OVER_RATIO: 1.0,

  // 统计
  TREND_MONTHS: 6,
  RANK_TOP_N: 5,
  LIST_PAGE_SIZE: 30,
  STREAK_MILESTONES: [3, 7, 30],
  REPORT_MIN_COUNT: 15,

  // 存储
  STORAGE_KEY: 'shark_ledger_v1',
  BACKUP_KEY: 'shark_ledger_backup',
  SAVE_DEBOUNCE_MS: 200,

  // 动效
  TOAST_MS: 1600,
  ANIM_MS: 240,
  SAVE_LOCK_MS: 300,
  SHAKE_MS: 300,

  // 颜色
  COLOR: {
    primary: '#2BB3A3',
    primaryLight: '#7FD9CE',
    bg: '#F7F8FA',
    card: '#FFFFFF',
    text: '#1F2329',
    sub: '#8A9099',
    expense: '#FF6B5B',
    warn: '#FFB020',
    transfer: '#4E8CFF'
  },
  CHART_COLORS: ['#2BB3A3', '#4E8CFF', '#FFB020', '#FF6B5B', '#9B7BFF', '#34C77B', '#FF8FB1', '#5AC8FA', '#C9A227', '#7A869A'],

  // 资源
  IMAGES: {
    header: 'assets/images/header_bg.png',
    emptyShark: 'assets/images/empty_shark_transparent.png',
    medal: 'assets/images/medal_transparent.png'
  },
  AUDIO: {
    success: 'assets/audio/success.mp3',
    fail: 'assets/audio/fail.mp3'
  },

  // 默认分类
  DEFAULT_EXPENSE: [
    ['餐饮', '🍚'], ['购物', '🛒'], ['交通', '🚌'], ['居住', '🏠'],
    ['通讯', '📱'], ['娱乐', '🎮'], ['医疗', '💊'], ['学习', '📚'],
    ['服饰', '👕'], ['美容', '💅'], ['宠物', '🐱'], ['人情', '🎁'],
    ['旅行', '✈️'], ['烟酒', '🚬'], ['缴费', '🧾'], ['其他', '💸']
  ],
  DEFAULT_INCOME: [
    ['工资', '💰'], ['奖金', '🎯'], ['理财', '📈'],
    ['红包', '🧧'], ['退款', '🔄'], ['其他', '✨']
  ],
  DEFAULT_ACCOUNTS: [
    ['现金', '💵'], ['银行卡', '💳'], ['支付宝', '🅰️'], ['微信钱包', '🟢']
  ],
  EMOJI_PICKER: ['🍚', '🍜', '☕', '🛒', '🚌', '🚕', '🏠', '📱', '🎮', '💊', '📚', '👕', '💅', '🐱', '🎁', '✈️', '🚬', '🧾', '💸', '💰', '🎯', '📈', '🧧', '🔄', '✨', '⚽', '🎵', '🎬', '🧸', '🌷'],

  DEFAULT_BOOK_NAME: '日常账本',
  BOOK_ICONS: ['📒', '✈️', '🔨', '💼', '❤️', '🎓']
};
