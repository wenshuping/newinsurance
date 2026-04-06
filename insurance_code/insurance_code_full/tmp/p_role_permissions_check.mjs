import { chromium } from 'playwright';

const API = 'http://127.0.0.1:4100';
const APP = 'http://127.0.0.1:3005';

async function login(account, password) {
  const res = await fetch(`${API}/api/p/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, password }),
  });
  const json = await res.json();
  if (!json?.ok || !json?.session) throw new Error(`login failed for ${account}: ${JSON.stringify(json)}`);
  return json.session;
}

async function openWithSession(browser, session) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript((payload) => {
    window.sessionStorage.setItem('p_admin_session_v1', JSON.stringify(payload.session));
    window.sessionStorage.setItem('p_admin_csrf_v1', String(payload.session.csrfToken || ''));
  }, { session });
  await page.goto(APP, { waitUntil: 'networkidle' });
  return { context, page };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const company = await login('xinhua@126.com', '123456');
    const teamLead = await login('fangyuqing@126.com', '123456');
    const agent = await login('xiaoying@126.com', '123456');

    const companyView = await openWithSession(browser, company);
    await companyView.page.getByRole('link', { name: '员工管理', exact: true }).click();
    await companyView.page.waitForTimeout(800);
    const companyText = await companyView.page.locator('body').innerText();
    console.log('COMPANY_HAS_ROLE_CONFIG=' + companyText.includes('基于角色的权限控制'));
    await companyView.page.screenshot({ path: '/tmp/p-company-role-config.png', fullPage: true });
    await companyView.context.close();

    const teamView = await openWithSession(browser, teamLead);
    const teamText = await teamView.page.locator('body').innerText();
    console.log('TEAM_HAS_EMPLOYEES=' + teamText.includes('员工管理'));
    console.log('TEAM_HAS_ACTIVITY=' + teamText.includes('活动中心'));
    console.log('TEAM_HAS_LEARNING=' + teamText.includes('学习资料'));
    console.log('TEAM_HAS_SHOP=' + teamText.includes('积分商城'));
    console.log('TEAM_HAS_STATS=' + teamText.includes('业绩看板'));
    console.log('TEAM_HAS_STRATEGY_GROUP=' + teamText.includes('策略引擎'));
    console.log('TEAM_HAS_TAG_LIST=' + teamText.includes('标签列表'));
    await teamView.page.screenshot({ path: '/tmp/p-team-lead-sidebar.png', fullPage: true });
    await teamView.context.close();

    const agentView = await openWithSession(browser, agent);
    const agentText = await agentView.page.locator('body').innerText();
    console.log('AGENT_HAS_EMPLOYEES=' + agentText.includes('员工管理'));
    console.log('AGENT_HAS_ACTIVITY=' + agentText.includes('活动中心'));
    console.log('AGENT_HAS_LEARNING=' + agentText.includes('学习资料'));
    console.log('AGENT_HAS_SHOP=' + agentText.includes('积分商城'));
    console.log('AGENT_HAS_STATS=' + agentText.includes('业绩看板'));
    console.log('AGENT_HAS_STRATEGY_GROUP=' + agentText.includes('策略引擎'));
    console.log('AGENT_HAS_TAG_LIST=' + agentText.includes('标签列表'));
    await agentView.page.screenshot({ path: '/tmp/p-agent-sidebar.png', fullPage: true });
    await agentView.context.close();
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
