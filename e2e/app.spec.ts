import { expect, test } from '@playwright/test';

const SETTINGS_KEY = 'sudoku:settings:v1';

async function seedSettings(page: import('@playwright/test').Page, theme: 'night' | 'day' = 'night') {
  await page.addInitScript(
    ({ key, theme }) => {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(
        key,
        JSON.stringify({ theme, haptics: false, sound: false, onboarded: true }),
      );
    },
    { key: SETTINGS_KEY, theme },
  );
}

async function startEasy(page: import('@playwright/test').Page) {
  await page.goto('./');
  await page.getByRole('button', { name: /简单/ }).click();
  await expect(page.locator('.board')).toBeVisible();
}

async function firstEmptyCell(page: import('@playwright/test').Page): Promise<number> {
  const cell = await page.evaluate(() => {
    const cells = [...document.querySelectorAll<HTMLElement>('.cell')];
    return cells.findIndex((element) => element.getAttribute('aria-label')?.includes('空'));
  });
  if (cell < 0) throw new Error('没有空格');
  return cell;
}

test('第一次打开会先教手势，然后开始一局', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.onboarding')).toBeVisible();
  await expect(page.locator('#onboarding-title')).toHaveText('数独怎么玩');
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await expect(page.locator('.onboarding')).toHaveCount(0);

  await page.getByRole('button', { name: /简单/ }).click();
  await expect(page.locator('.board')).toBeVisible();
  await expect(page.locator('.cell')).toHaveCount(81);
  await expect(page.locator('.key')).toHaveCount(9);
  await expect(page.locator('.chip-timer')).toHaveText('00:00');
  await expect(page.locator('.gesture-hint')).toHaveText('轻点记笔记 · 长按填答案');
});

test('长按擦除清空全部笔记，撤销恢复', async ({ page }) => {
  await seedSettings(page);
  await startEasy(page);

  const empties = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.cell')]
      .map((cell, index) => ({ index, label: cell.getAttribute('aria-label') }))
      .filter((cell) => cell.label?.includes('空'))
      .slice(0, 2)
      .map((cell) => cell.index),
  );
  expect(empties).toHaveLength(2);

  for (const cell of empties) {
    await page.locator(`.cell[data-cell="${cell}"]`).click();
    const allowed = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.key:not(.blocked):not(.done)')].map((key) =>
        Number(key.dataset.digit),
      ),
    );
    expect(allowed.length).toBeGreaterThan(0);
    await page.locator(`.key[data-digit="${allowed[0]}"]`).click();
  }
  const notes = await page.locator('.notes i.on').count();
  expect(notes).toBeGreaterThanOrEqual(2);

  const erase = page.locator('[data-action="erase"]');
  const box = await erase.boundingBox();
  if (!box) throw new Error('擦除按钮不可见');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();

  await expect(page.locator('.hintbar')).toContainText('已清除全部笔记');
  await expect(page.locator('.notes i.on')).toHaveCount(0);

  // 再长按一次：没有笔记时应说明，而不是静默。
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await expect(page.locator('.hintbar')).toContainText('没有笔记可清除');

  await page.locator('[data-action="undo"]').click();
  await expect(page.locator('.notes i.on')).toHaveCount(notes);
});

test('轻点记笔记，长按填答案，撤销恢复', async ({ page }) => {
  await seedSettings(page);
  await startEasy(page);

  const cell = await firstEmptyCell(page);
  await page.locator(`.cell[data-cell="${cell}"]`).click();

  const allowed = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.key:not(.blocked):not(.done)')].map((key) =>
      Number(key.dataset.digit),
    ),
  );
  expect(allowed.length).toBeGreaterThan(0);
  const digit = allowed[0]!;

  await page.locator(`.key[data-digit="${digit}"]`).click();
  await expect(page.locator(`.cell[data-cell="${cell}"]`)).toHaveAttribute(
    'aria-label',
    new RegExp(`候选 ${digit}`),
  );

  // 被划掉的数字一定已在同行/列/宫中，长按填入必然标红。
  const blocked = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.key.blocked')].map((key) =>
      Number(key.dataset.digit),
    ),
  );
  expect(blocked.length).toBeGreaterThan(0);
  const wrongDigit = blocked[0]!;
  const key = page.locator(`.key[data-digit="${wrongDigit}"]`);
  const box = await key.boundingBox();
  if (!box) throw new Error('键盘不可见');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();

  await expect(page.locator(`.cell[data-cell="${cell}"]`)).toHaveAttribute(
    'aria-label',
    /错误/,
  );
  await expect(page.locator('.hintbar')).toContainText('不对');

  await page.locator('[data-action="undo"]').click();
  await expect(page.locator(`.cell[data-cell="${cell}"]`)).toHaveAttribute(
    'aria-label',
    new RegExp(`候选 ${digit}`),
  );
});

test('刷新后从存档继续，首页出现继续卡片', async ({ page }) => {
  await seedSettings(page);
  await startEasy(page);

  // 用提示揭示一格，确保盘面有变化。
  await page.locator('[data-action="hint"]').click();
  await page.locator('[data-action="hint"]').click();
  await page.locator('[data-action="hint"]').click();
  await expect(page.locator('.cell.user')).toHaveCount(1);

  await page.reload();
  await expect(page.locator('.board')).toBeVisible();
  const resume = page.locator('[data-action="resume"]');
  if (await resume.count()) await resume.click();
  await expect(page.locator('.cell.user')).toHaveCount(1);

  await page.locator('[data-action="exit"]').click();
  await expect(page.locator('.continue-card')).toBeVisible();
  await expect(page.locator('.continue-card')).toContainText('简单');
});

test('完成一局会写入记录并清掉存档', async ({ page }) => {
  test.setTimeout(120_000);
  await seedSettings(page);
  await startEasy(page);

  const hint = page.locator('[data-action="hint"]');
  for (let round = 0; round < 80; round++) {
    if (await page.locator('.overlay').count()) break;
    await hint.click();
    await hint.click();
    await hint.click();
  }

  await expect(page.locator('.overlay')).toBeVisible();
  await expect(page.locator('.sheet-title')).toHaveText('对局完成');
  await expect(page.locator('.result-stats')).toContainText('错误');
  await expect(page.locator('.result-stats')).toContainText('揭示');

  const saved = await page.evaluate(() => localStorage.getItem('sudoku:results:v1'));
  expect(saved).not.toBeNull();
  const results = JSON.parse(saved!) as Array<{ difficulty: string; timeSec: number }>;
  expect(results).toHaveLength(1);
  expect(results[0]!.difficulty).toBe('easy');
  expect(await page.evaluate(() => localStorage.getItem('sudoku:save:v1'))).toBeNull();

  await page.locator('[data-action="home"]').click();
  await expect(page.locator('.continue-card')).toHaveCount(0);
  await page.getByRole('button', { name: '统计' }).click();
  await expect(page.locator('.result-row')).toHaveCount(1);
  await expect(page.locator('.result-row').first()).toContainText('揭示');
  await expect(page.locator('.stat-foot').first()).toContainText('平均揭示');
});

test('设置里切换主题并持久化，清除数据前会确认', async ({ page }) => {
  await seedSettings(page, 'night');
  await page.goto('./#/settings');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'night');

  await page.getByRole('button', { name: '日间', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');
  const stored = await page.evaluate((key) => localStorage.getItem(key), SETTINGS_KEY);
  expect(JSON.parse(stored!).theme).toBe('day');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');

  await page.locator('[data-clear]').click();
  await expect(page.locator('.confirm-sheet')).toBeVisible();
  await page.locator('[data-cancel]').click();
  await expect(page.locator('.confirm-sheet')).toHaveCount(0);
});

test('开始新对局前会确认放弃当前存档', async ({ page }) => {
  await seedSettings(page);
  await startEasy(page);
  await page.locator('[data-action="exit"]').click();

  await page.getByRole('button', { name: /中等/ }).click();
  await expect(page.locator('.confirm-sheet')).toBeVisible();
  await page.locator('[data-confirm]').click();
  await expect(page.locator('.board')).toBeVisible();
  await expect(page.locator('.chip-difficulty')).toHaveText('中等');
});

test('开始新对局可以取消，存档不会被覆盖', async ({ page }) => {
  await seedSettings(page);
  await startEasy(page);
  await page.locator('[data-action="exit"]').click();
  await expect(page.locator('.continue-card')).toBeVisible();

  await page.getByRole('button', { name: /困难/ }).click();
  await page.locator('[data-cancel]').click();
  await expect(page.locator('.continue-card')).toBeVisible();
  await expect(page.locator('.board')).toHaveCount(0);
});

test.describe('浅色系统首次打开', () => {
  test.use({ colorScheme: 'light' });

  test('首帧就是日间，不会闪夜色', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');
  });
});

test.describe('小屏', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('320×568 下对局不滚动，键位不小于 44px', async ({ page }) => {
    await seedSettings(page);
    await startEasy(page);
    await page.locator('[data-action="hint"]').click();
    await page.locator('[data-action="hint"]').click();

    const metrics = await page.evaluate(() => {
      const key = document.querySelector('.key')!.getBoundingClientRect();
      return {
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        width: innerWidth,
        height: innerHeight,
        keyWidth: key.width,
        keyHeight: key.height,
      };
    });
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width);
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.height);
    expect(metrics.keyWidth).toBeGreaterThanOrEqual(44);
    expect(metrics.keyHeight).toBeGreaterThanOrEqual(44);
  });
});

test('离线时重新打开仍能进入首页', async ({ page, context }) => {
  await seedSettings(page);
  await page.goto('./');
  await expect(page.locator('.difficulty-card').first()).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.difficulty-card')).toHaveCount(4);
  await context.setOffline(false);
});
