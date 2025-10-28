/**
 * 开发环境 Mock 数据脚本
 * 方便在开发时拦截并模拟 API 响应
 */

// Tampermonkey API 兼容性处理（用于开发环境）
const GMCompat = {
  getValue: (key: string, defaultValue: any) => {
    if (typeof GM_getValue !== 'undefined') {
      return GM_getValue(key, defaultValue);
    }
    // 开发环境使用 localStorage
    const value = localStorage.getItem(`gm_${key}`);
    return value ? value : defaultValue;
  },
  
  setValue: (key: string, value: any) => {
    if (typeof GM_setValue !== 'undefined') {
      return GM_setValue(key, value);
    }
    // 开发环境使用 localStorage
    localStorage.setItem(`gm_${key}`, value);
  },
  
  addStyle: (css: string) => {
    if (typeof GM_addStyle !== 'undefined') {
      return GM_addStyle(css);
    }
    // 开发环境手动添加样式
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }
};

// Mock 规则接口
interface MockRule {
  id: string;
  enabled: boolean;
  name: string;
  urlPattern: string; // 支持正则表达式
  method: string; // GET, POST, PUT, DELETE, ALL
  responseType: 'json' | 'text';
  responseData: string;
  statusCode: number;
  delay: number; // 延迟响应（毫秒）
}

// 请求日志接口
interface RequestLog {
  id: string;
  timestamp: number;
  url: string;
  method: string;
  matched: boolean;
  ruleId?: string;
}

// 脚本配置
interface ScriptConfig {
  enabled: boolean;
  rules: MockRule[];
  showNotification: boolean;
  logRequests: boolean;
}

// 默认配置
const defaultConfig: ScriptConfig = {
  enabled: true,
  rules: [],
  showNotification: true,
  logRequests: true,
};

// 全局状态
let config: ScriptConfig = defaultConfig;
let requestLogs: RequestLog[] = [];
let originalFetch: typeof fetch;
let originalXHROpen: typeof XMLHttpRequest.prototype.open;
let originalXHRSend: typeof XMLHttpRequest.prototype.send;

// 加载配置
function loadConfig(): ScriptConfig {
  try {
    const saved = GMCompat.getValue('mock_config', null);
    if (saved) {
      return { ...defaultConfig, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('加载配置失败:', e);
  }
  return defaultConfig;
}

// 保存配置
function saveConfig() {
  try {
    GMCompat.setValue('mock_config', JSON.stringify(config));
  } catch (e) {
    console.error('保存配置失败:', e);
  }
}

// 匹配规则
function matchRule(url: string, method: string): MockRule | null {
  if (!config.enabled) return null;

  for (const rule of config.rules) {
    if (!rule.enabled) continue;
    
    // 方法匹配
    if (rule.method !== 'ALL' && rule.method !== method.toUpperCase()) {
      continue;
    }

    // URL 匹配（支持正则表达式和字符串匹配）
    let matched = false;
    
    try {
      // 尝试作为正则表达式匹配
      const pattern = new RegExp(rule.urlPattern);
      matched = pattern.test(url);
    } catch (e) {
      // 如果正则表达式无效，使用字符串包含匹配
      matched = url.includes(rule.urlPattern);
    }

    if (matched) {
      console.log(`✅ Mock 规则匹配成功: [${rule.name}]`, {
        url,
        method,
        pattern: rule.urlPattern
      });
      return rule;
    }
  }

  return null;
}

// 添加请求日志
function addRequestLog(url: string, method: string, matched: boolean, ruleId?: string) {
  if (!config.logRequests) return;

  const log: RequestLog = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    timestamp: Date.now(),
    url,
    method,
    matched,
    ruleId,
  };

  requestLogs.unshift(log);
  
  // 只保留最近 100 条日志
  if (requestLogs.length > 100) {
    requestLogs = requestLogs.slice(0, 100);
  }
}

// 拦截 Fetch
function interceptFetch() {
  originalFetch = window.fetch;

  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method || 'GET';

    const rule = matchRule(url, method);

    if (rule) {
      addRequestLog(url, method, true, rule.id);
      
      if (config.showNotification) {
        console.log(`🎭 Mock: ${method} ${url} -> ${rule.name}`);
      }

      // 模拟延迟
      if (rule.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, rule.delay));
      }

      // 创建模拟响应
      const responseData = rule.responseType === 'json' 
        ? JSON.parse(rule.responseData)
        : rule.responseData;

      return new Response(
        rule.responseType === 'json' ? JSON.stringify(responseData) : responseData,
        {
          status: rule.statusCode,
          statusText: 'OK',
          headers: {
            'Content-Type': rule.responseType === 'json' 
              ? 'application/json' 
              : 'text/plain',
          },
        }
      );
    }

    addRequestLog(url, method, false);
    return originalFetch.apply(this, [input, init] as any);
  };
}

// 拦截 XMLHttpRequest
function interceptXHR() {
  originalXHROpen = XMLHttpRequest.prototype.open;
  originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(
    method: string,
    url: string | URL,
    async: boolean = true,
    username?: string | null,
    password?: string | null
  ) {
    const urlStr = typeof url === 'string' ? url : url.href;
    (this as any)._mockUrl = urlStr;
    (this as any)._mockMethod = method;

    return originalXHROpen.apply(this, [method, url, async, username, password] as any);
  };

  XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
    const url = (this as any)._mockUrl;
    const method = (this as any)._mockMethod;

    if (url && method) {
      const rule = matchRule(url, method);

      if (rule) {
        addRequestLog(url, method, true, rule.id);

        if (config.showNotification) {
          console.log(`🎭 Mock: ${method} ${url} -> ${rule.name}`);
        }

        // 标记为已拦截，阻止实际请求
        (this as any)._mockIntercepted = true;

        // 模拟异步响应
        setTimeout(() => {
          // 模拟 readyState 变化
          Object.defineProperty(this, 'readyState', { value: 1, writable: true, configurable: true });
          this.dispatchEvent(new Event('readystatechange'));

          Object.defineProperty(this, 'readyState', { value: 2, writable: true, configurable: true });
          this.dispatchEvent(new Event('readystatechange'));

          Object.defineProperty(this, 'readyState', { value: 3, writable: true, configurable: true });
          this.dispatchEvent(new Event('readystatechange'));

          // 设置响应数据
          Object.defineProperty(this, 'readyState', { value: 4, writable: true, configurable: true });
          Object.defineProperty(this, 'status', { value: rule.statusCode, writable: false, configurable: true });
          Object.defineProperty(this, 'statusText', { value: 'OK', writable: false, configurable: true });
          Object.defineProperty(this, 'responseText', { value: rule.responseData, writable: false, configurable: true });
          
          // 设置响应类型
          if (rule.responseType === 'json') {
            try {
              Object.defineProperty(this, 'response', { 
                value: JSON.parse(rule.responseData), 
                writable: false,
                configurable: true
              });
              Object.defineProperty(this, 'responseType', { 
                value: 'json', 
                writable: false,
                configurable: true
              });
            } catch (e) {
              console.error('Mock 数据 JSON 解析失败:', e);
              Object.defineProperty(this, 'response', { 
                value: rule.responseData, 
                writable: false,
                configurable: true
              });
            }
          } else {
            Object.defineProperty(this, 'response', { 
              value: rule.responseData, 
              writable: false,
              configurable: true
            });
          }

          // 设置响应头
          (this as any).getAllResponseHeaders = () => {
            return `Content-Type: ${rule.responseType === 'json' ? 'application/json' : 'text/plain'}\r\n`;
          };
          (this as any).getResponseHeader = (name: string) => {
            if (name.toLowerCase() === 'content-type') {
              return rule.responseType === 'json' ? 'application/json' : 'text/plain';
            }
            return null;
          };

          // 触发完成事件
          this.dispatchEvent(new Event('readystatechange'));
          this.dispatchEvent(new Event('load'));
          this.dispatchEvent(new Event('loadend'));
        }, rule.delay);

        // 不调用原始的 send 方法
        return;
      }

      addRequestLog(url, method, false);
    }

    // 没有匹配到规则，调用原始方法
    return originalXHRSend.apply(this, [body] as any);
  };
}

// 生成唯一 ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 创建控制面板
function createControlPanel() {
  // 添加样式
  GMCompat.addStyle(`
    .mock-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90%;
      max-width: 900px;
      max-height: 90vh;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      z-index: 999999;
      display: none;
      flex-direction: column;
      overflow: hidden;
    }

    .mock-panel.show {
      display: flex;
    }

    .mock-panel-header {
      padding: 20px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .mock-panel-title {
      font-size: 18px;
      font-weight: 600;
      margin: 0;
    }

    .mock-panel-close {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
      transition: background 0.2s;
    }

    .mock-panel-close:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .mock-panel-tabs {
      display: flex;
      background: #f5f5f5;
      border-bottom: 1px solid #e0e0e0;
    }

    .mock-panel-tab {
      padding: 12px 24px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      color: #666;
      transition: all 0.2s;
      border-bottom: 2px solid transparent;
    }

    .mock-panel-tab.active {
      color: #667eea;
      border-bottom-color: #667eea;
      background: white;
    }

    .mock-panel-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    .mock-rule {
      background: #f9f9f9;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }

    .mock-rule-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .mock-rule-name {
      font-weight: 600;
      font-size: 16px;
      color: #333;
    }

    .mock-rule-actions {
      display: flex;
      gap: 8px;
    }

    .mock-btn {
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s;
    }

    .mock-btn-primary {
      background: #667eea;
      color: white;
    }

    .mock-btn-primary:hover {
      background: #5568d3;
    }

    .mock-btn-danger {
      background: #f5576c;
      color: white;
    }

    .mock-btn-danger:hover {
      background: #e04556;
    }

    .mock-btn-secondary {
      background: #e0e0e0;
      color: #333;
    }

    .mock-btn-secondary:hover {
      background: #d0d0d0;
    }

    .mock-form-group {
      margin-bottom: 16px;
    }

    .mock-form-label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      color: #333;
      font-size: 14px;
    }

    .mock-form-input,
    .mock-form-select,
    .mock-form-textarea {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      font-family: inherit;
      box-sizing: border-box;
    }

    .mock-form-textarea {
      min-height: 120px;
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    }

    .mock-toggle-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 999998;
      transition: all 0.3s;
    }

    .mock-toggle-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    }

    .mock-toggle-btn.disabled {
      background: linear-gradient(135deg, #ccc 0%, #999 100%);
    }

    .mock-status {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .mock-status.enabled {
      background: #d4edda;
      color: #155724;
    }

    .mock-status.disabled {
      background: #f8d7da;
      color: #721c24;
    }

    .mock-log-item {
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 13px;
    }

    .mock-log-item:last-child {
      border-bottom: none;
    }

    .mock-log-matched {
      background: #d4edda;
    }

    .mock-toolbar {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }

    .mock-form-group code {
      background: #e8f0fe;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 11px;
      color: #1a73e8;
    }
  `);

  // 创建面板 HTML
  const panel = document.createElement('div');
  panel.className = 'mock-panel';
  panel.innerHTML = `
    <div class="mock-panel-header">
      <h3 class="mock-panel-title">🎭 Mock 数据管理</h3>
      <button class="mock-panel-close">×</button>
    </div>
    <div class="mock-panel-tabs">
      <button class="mock-panel-tab active" data-tab="rules">Mock 规则</button>
      <button class="mock-panel-tab" data-tab="logs">请求日志</button>
      <button class="mock-panel-tab" data-tab="settings">设置</button>
    </div>
    <div class="mock-panel-content">
      <div id="mock-tab-rules"></div>
      <div id="mock-tab-logs" style="display: none;"></div>
      <div id="mock-tab-settings" style="display: none;"></div>
    </div>
  `;

  // 创建切换按钮
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'mock-toggle-btn';
  toggleBtn.textContent = '🎭';
  toggleBtn.title = 'Mock 数据管理';

  // 等待 body 加载
  const addToPage = () => {
    if (document.body) {
      document.body.appendChild(panel);
      document.body.appendChild(toggleBtn);
      initPanelEvents(panel, toggleBtn);
    } else {
      setTimeout(addToPage, 100);
    }
  };

  addToPage();
}

// 初始化面板事件
function initPanelEvents(panel: HTMLElement, toggleBtn: HTMLElement) {
  // 切换按钮点击
  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('show');
    if (panel.classList.contains('show')) {
      renderRules();
    }
  });

  // 关闭按钮
  const closeBtn = panel.querySelector('.mock-panel-close');
  closeBtn?.addEventListener('click', () => {
    panel.classList.remove('show');
  });

  // Tab 切换
  const tabs = panel.querySelectorAll('.mock-panel-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      
      // 更新 Tab 状态
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // 显示对应内容
      const contents = ['rules', 'logs', 'settings'];
      contents.forEach(name => {
        const content = document.getElementById(`mock-tab-${name}`);
        if (content) {
          content.style.display = name === targetTab ? 'block' : 'none';
        }
      });

      // 渲染内容
      if (targetTab === 'rules') renderRules();
      if (targetTab === 'logs') renderLogs();
      if (targetTab === 'settings') renderSettings();
    });
  });

  // 更新按钮状态
  function updateToggleBtnState() {
    if (config.enabled) {
      toggleBtn.classList.remove('disabled');
      toggleBtn.title = 'Mock 已启用 - 点击管理';
    } else {
      toggleBtn.classList.add('disabled');
      toggleBtn.title = 'Mock 已禁用 - 点击管理';
    }
  }

  updateToggleBtnState();
}

// 渲染规则列表
function renderRules() {
  const container = document.getElementById('mock-tab-rules');
  if (!container) return;

  const html = `
    <div class="mock-toolbar">
      <button class="mock-btn mock-btn-primary" id="mock-add-rule">+ 添加规则</button>
      <button class="mock-btn mock-btn-secondary" id="mock-import">导入配置</button>
      <button class="mock-btn mock-btn-secondary" id="mock-export">导出配置</button>
    </div>
    <div id="mock-rules-list">
      ${config.rules.length === 0 ? '<p style="color: #999; text-align: center; padding: 40px 0;">暂无规则，点击上方按钮添加</p>' : ''}
      ${config.rules.map(rule => `
        <div class="mock-rule">
          <div class="mock-rule-header">
            <div>
              <span class="mock-rule-name">${rule.name}</span>
              <span class="mock-status ${rule.enabled ? 'enabled' : 'disabled'}">
                ${rule.enabled ? '已启用' : '已禁用'}
              </span>
            </div>
            <div class="mock-rule-actions">
              <button class="mock-btn mock-btn-primary" data-action="edit" data-id="${rule.id}">编辑</button>
              <button class="mock-btn mock-btn-secondary" data-action="toggle" data-id="${rule.id}">
                ${rule.enabled ? '禁用' : '启用'}
              </button>
              <button class="mock-btn mock-btn-danger" data-action="delete" data-id="${rule.id}">删除</button>
            </div>
          </div>
          <div style="font-size: 13px; color: #666; margin-top: 8px;">
            <div><strong>方法:</strong> ${rule.method}</div>
            <div><strong>URL:</strong> ${rule.urlPattern}</div>
            <div><strong>状态码:</strong> ${rule.statusCode} | <strong>延迟:</strong> ${rule.delay}ms</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  container.innerHTML = html;

  // 绑定事件
  container.querySelector('#mock-add-rule')?.addEventListener('click', () => showRuleEditor());
  container.querySelector('#mock-import')?.addEventListener('click', importConfig);
  container.querySelector('#mock-export')?.addEventListener('click', exportConfig);

  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.getAttribute('data-action');
      const id = target.getAttribute('data-id');

      if (!id) return;

      if (action === 'edit') {
        const rule = config.rules.find(r => r.id === id);
        if (rule) showRuleEditor(rule);
      } else if (action === 'toggle') {
        const rule = config.rules.find(r => r.id === id);
        if (rule) {
          rule.enabled = !rule.enabled;
          saveConfig();
          renderRules();
        }
      } else if (action === 'delete') {
        if (confirm('确定要删除这条规则吗？')) {
          config.rules = config.rules.filter(r => r.id !== id);
          saveConfig();
          renderRules();
        }
      }
    });
  });
}

// 显示规则编辑器
function showRuleEditor(rule?: MockRule) {
  const isEdit = !!rule;
  const data = rule || {
    id: generateId(),
    enabled: true,
    name: '',
    urlPattern: '',
    method: 'ALL',
    responseType: 'json' as const,
    responseData: '{}',
    statusCode: 200,
    delay: 0,
  };

  const container = document.getElementById('mock-tab-rules');
  if (!container) return;

  const html = `
    <div style="max-width: 700px;">
      <h4>${isEdit ? '编辑规则' : '添加规则'}</h4>
      <form id="mock-rule-form">
        <div class="mock-form-group">
          <label class="mock-form-label">规则名称</label>
          <input type="text" class="mock-form-input" name="name" value="${data.name}" placeholder="例如: 用户信息接口" required>
        </div>
        <div class="mock-form-group">
          <label class="mock-form-label">URL 匹配规则</label>
          <input type="text" class="mock-form-input" name="urlPattern" value="${data.urlPattern}" placeholder="/api/user/info" required>
          <div style="margin-top: 8px; padding: 12px; background: #f0f7ff; border-radius: 4px; font-size: 12px; color: #666;">
            <div style="font-weight: 600; margin-bottom: 6px;">💡 匹配方式说明：</div>
            <div style="line-height: 1.6;">
              • <strong>字符串匹配</strong>：输入 <code>/api/user</code> 可匹配包含此路径的所有请求<br>
              • <strong>正则表达式</strong>：输入 <code>/api/user/\\d+</code> 可匹配 /api/user/123 等<br>
              • <strong>精确匹配</strong>：输入 <code>^https://example\\.com/api/user$</code><br>
              • <strong>多个路径</strong>：输入 <code>/api/(user|product)</code> 匹配多个路径
            </div>
          </div>
        </div>
        <div class="mock-form-group">
          <label class="mock-form-label">请求方法</label>
          <select class="mock-form-select" name="method">
            <option value="ALL" ${data.method === 'ALL' ? 'selected' : ''}>全部</option>
            <option value="GET" ${data.method === 'GET' ? 'selected' : ''}>GET</option>
            <option value="POST" ${data.method === 'POST' ? 'selected' : ''}>POST</option>
            <option value="PUT" ${data.method === 'PUT' ? 'selected' : ''}>PUT</option>
            <option value="DELETE" ${data.method === 'DELETE' ? 'selected' : ''}>DELETE</option>
          </select>
        </div>
        <div class="mock-form-group">
          <label class="mock-form-label">响应类型</label>
          <select class="mock-form-select" name="responseType">
            <option value="json" ${data.responseType === 'json' ? 'selected' : ''}>JSON</option>
            <option value="text" ${data.responseType === 'text' ? 'selected' : ''}>Text</option>
          </select>
        </div>
        <div class="mock-form-group">
          <label class="mock-form-label">响应数据</label>
          <textarea class="mock-form-textarea" name="responseData" placeholder='{"code": 0, "message": "success", "data": {...}}'>${data.responseData}</textarea>
          <div style="margin-top: 4px; font-size: 12px; color: #999;">
            提示：请确保 JSON 格式正确，否则会导致解析失败
          </div>
        </div>
        <div class="mock-form-group">
          <label class="mock-form-label">HTTP 状态码</label>
          <input type="number" class="mock-form-input" name="statusCode" value="${data.statusCode}" min="100" max="599">
        </div>
        <div class="mock-form-group">
          <label class="mock-form-label">延迟（毫秒）</label>
          <input type="number" class="mock-form-input" name="delay" value="${data.delay}" min="0" placeholder="0">
          <div style="margin-top: 4px; font-size: 12px; color: #999;">
            模拟网络延迟，0 表示立即响应
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="submit" class="mock-btn mock-btn-primary">保存</button>
          <button type="button" class="mock-btn mock-btn-secondary" id="mock-cancel-edit">取消</button>
        </div>
      </form>
    </div>
  `;

  container.innerHTML = html;

  const form = document.getElementById('mock-rule-form') as HTMLFormElement;
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const formData = new FormData(form);
    const newRule: MockRule = {
      id: data.id,
      enabled: data.enabled,
      name: formData.get('name') as string,
      urlPattern: formData.get('urlPattern') as string,
      method: formData.get('method') as string,
      responseType: formData.get('responseType') as 'json' | 'text',
      responseData: formData.get('responseData') as string,
      statusCode: parseInt(formData.get('statusCode') as string),
      delay: parseInt(formData.get('delay') as string),
    };

    if (isEdit) {
      const index = config.rules.findIndex(r => r.id === data.id);
      if (index !== -1) {
        config.rules[index] = newRule;
      }
    } else {
      config.rules.push(newRule);
    }

    saveConfig();
    renderRules();
  });

  container.querySelector('#mock-cancel-edit')?.addEventListener('click', () => {
    renderRules();
  });
}

// 渲染日志
function renderLogs() {
  const container = document.getElementById('mock-tab-logs');
  if (!container) return;

  const html = `
    <div class="mock-toolbar">
      <button class="mock-btn mock-btn-danger" id="mock-clear-logs">清空日志</button>
      <span style="margin-left: auto; color: #666; font-size: 13px;">
        共 ${requestLogs.length} 条请求
      </span>
    </div>
    <div>
      ${requestLogs.length === 0 ? '<p style="color: #999; text-align: center; padding: 40px 0;">暂无请求日志</p>' : ''}
      ${requestLogs.map(log => {
        const rule = log.ruleId ? config.rules.find(r => r.id === log.ruleId) : null;
        const time = new Date(log.timestamp).toLocaleTimeString();
        return `
          <div class="mock-log-item ${log.matched ? 'mock-log-matched' : ''}">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span><strong>${log.method}</strong> ${log.url}</span>
              <span style="color: #999;">${time}</span>
            </div>
            ${log.matched && rule ? `<div style="color: #155724; font-size: 12px;">✓ 已拦截 - ${rule.name}</div>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;

  container.innerHTML = html;

  container.querySelector('#mock-clear-logs')?.addEventListener('click', () => {
    requestLogs = [];
    renderLogs();
  });
}

// 渲染设置
function renderSettings() {
  const container = document.getElementById('mock-tab-settings');
  if (!container) return;

  const html = `
    <div style="max-width: 600px;">
      <h4>全局设置</h4>
      <div class="mock-form-group">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" id="mock-enabled" ${config.enabled ? 'checked' : ''}>
          <span>启用 Mock 功能</span>
        </label>
      </div>
      <div class="mock-form-group">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" id="mock-show-notification" ${config.showNotification ? 'checked' : ''}>
          <span>显示拦截通知（控制台）</span>
        </label>
      </div>
      <div class="mock-form-group">
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" id="mock-log-requests" ${config.logRequests ? 'checked' : ''}>
          <span>记录请求日志</span>
        </label>
      </div>
      <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e0e0e0;">
        <h4>关于</h4>
        <p style="color: #666; font-size: 14px;">
          Mock 数据脚本 v1.0<br>
          用于开发环境快速模拟 API 响应<br>
          支持 XHR 和 Fetch 请求拦截
        </p>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // 绑定设置变更事件
  container.querySelector('#mock-enabled')?.addEventListener('change', (e) => {
    config.enabled = (e.target as HTMLInputElement).checked;
    saveConfig();
    // 更新切换按钮状态
    const toggleBtn = document.querySelector('.mock-toggle-btn');
    if (toggleBtn) {
      if (config.enabled) {
        toggleBtn.classList.remove('disabled');
      } else {
        toggleBtn.classList.add('disabled');
      }
    }
  });

  container.querySelector('#mock-show-notification')?.addEventListener('change', (e) => {
    config.showNotification = (e.target as HTMLInputElement).checked;
    saveConfig();
  });

  container.querySelector('#mock-log-requests')?.addEventListener('change', (e) => {
    config.logRequests = (e.target as HTMLInputElement).checked;
    saveConfig();
  });
}

// 导出配置
function exportConfig() {
  const data = JSON.stringify(config, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mock-config-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// 导入配置
function importConfig() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (confirm('确定要导入配置吗？这将覆盖当前所有规则。')) {
          config = { ...defaultConfig, ...imported };
          saveConfig();
          renderRules();
          alert('导入成功！');
        }
      } catch (err) {
        alert('导入失败：文件格式错误');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// 主函数
function main() {
  console.log('🎭 Mock 数据脚本已启动！');
  
  // 加载配置
  config = loadConfig();
  
  // 拦截请求
  interceptFetch();
  interceptXHR();
  
  // 创建控制面板
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createControlPanel);
  } else {
    createControlPanel();
  }
}

// 启动脚本
main();

