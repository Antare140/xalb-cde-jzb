# 鲨鱼小账本 首版代码开发

## 任务清单
- [x] 工程骨架：index.html / css/style.css / js/config.js / js/utils.js / js/loader.js / js/input.js
- [x] 数据层 js/store.js：localStorage 读写、结构校验、CRUD、统计计算、异常兜底
- [x] P0：底部 Tab 导航、记账面板 + 自绘数字键盘、账单时间轴、月度汇总、分类体系、编辑与删除
- [x] P1：日历视图、图表页（环形图/趋势图/TOP5）、预算设置与三色预警、资产账户与转账
- [x] P2：多账本、分类自定义与排序、连续记账里程碑、跨月月报、隐私模式、CSV/JSON 导出导入、新手引导
- [x] 反馈层：Canvas 粒子 + 飘字 + 震动 + 音效接入 + 资源加载降级兜底
- [x] verify_game_code 检查通过
- [x] Playwright 最小路径验证（打开首页 → 跳过引导 → 记一笔 → 四页切换）
- [x] 收尾：deploy_manifest / CHANGELOG / README / project_status

## 执行记录
- 依据 docs/grd.md 第 10.3 优先级顺序实现，资源引用 3 图 2 音效已落盘
- 拆分模块：新增 js/store.js（数据层）、js/fx.js（反馈层）、js/charts.js（Canvas 图表）、js/ui.js（弹窗与引导），js/game.js 作为主控制器 App
- 验证发现并修复 2 个视觉问题：
  1. #app 被 flex 容器压缩导致比例变成 1:3 → 加 flex:0 0 auto 与 min-width/min-height，恢复 1:2
  2. 预算卡片负 margin 上移被头图裁切文字 → 改为正常间距，头图高度 340→312px
- 图表图例列宽调整，避免「笔」字换行
- Playwright 验证：无 JS 错误，画面比例 1:2，记一笔保存后汇总正确刷新，四个 Tab 页均正常
