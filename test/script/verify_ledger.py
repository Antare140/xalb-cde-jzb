#!/usr/bin/env python3
"""鲨鱼小账本最小路径验证：打开首页 -> 跳过引导 -> 记一笔"""
from playwright.sync_api import sync_playwright
import os

BASE_URL = "http://127.0.0.1:28711"
SHOT = "test/screenshot"
VIEWPORT = {"width": 480, "height": 900}


def run():
    os.makedirs(SHOT, exist_ok=True)
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport=VIEWPORT)
        page.on("pageerror", lambda e: errors.append(str(e)))
        try:
            page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2500)
            page.screenshot(path=f"{SHOT}/01_home.png")
            print("✓ 首页加载")

            # 跳过新手引导
            skip = page.locator("[data-skip]")
            if skip.count() > 0 and skip.first.is_visible():
                skip.first.click()
                page.wait_for_timeout(500)
                print("✓ 引导可跳过")
            page.screenshot(path=f"{SHOT}/02_bill.png")

            # 打开记账面板
            page.click("#tabAdd")
            page.wait_for_timeout(600)
            page.screenshot(path=f"{SHOT}/03_panel.png")
            print("✓ 记账面板打开")

            # 输入金额 88.5 并保存
            for k in ["8", "8", ".", "5"]:
                page.click(f'#keypad [data-k="{k}"]')
                page.wait_for_timeout(80)
            amount = page.locator("#amountVal").inner_text()
            print("  输入金额:", amount)
            page.click('#keypad [data-k="save"]')
            page.wait_for_timeout(1200)
            page.screenshot(path=f"{SHOT}/04_saved.png")
            expense = page.locator("#sumExpense").inner_text()
            print("✓ 保存成功，本月支出:", expense)

            # 切图表页
            page.click('#tabbar .tab[data-tab="chart"]')
            page.wait_for_timeout(800)
            page.screenshot(path=f"{SHOT}/05_chart.png")
            print("✓ 图表页正常")

            # 切资产页 / 我的页
            page.click('#tabbar .tab[data-tab="asset"]')
            page.wait_for_timeout(500)
            page.screenshot(path=f"{SHOT}/06_asset.png")
            page.click('#tabbar .tab[data-tab="mine"]')
            page.wait_for_timeout(500)
            page.screenshot(path=f"{SHOT}/07_mine.png")
            print("✓ 资产/我的页正常")

            # 比例检查
            info = page.evaluate(
                "() => { const a = document.getElementById('app');"
                "const r = a.getBoundingClientRect();"
                "return { w: r.width, h: r.height, ratio: r.height / r.width }; }"
            )
            print("  画面尺寸:", info)

            if errors:
                print("⚠ JS 错误:", errors[:5])
            else:
                print("✓ 无 JS 错误")
        finally:
            browser.close()


if __name__ == "__main__":
    run()
