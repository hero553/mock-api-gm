import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        // 脚本名称
        name: '开发环境 Mock 数据工具',
        // 命名空间
        namespace: 'http://tampermonkey.net/',
        // 脚本匹配的网址，可以使用通配符
        match: [
          'https://*/*',
          'http://*/*',
        ],
        // 脚本图标
        icon: '🎭',
        // 脚本描述
        description: '方便好用的 Mock 数据工具，支持拦截和模拟 API 响应，适用于开发调试',
        // 作者
        author: 'hero553',
        // 版本
        version: '1.0.0',
        // 主页
        homepage: 'https://github.com/hero553/mock-api-gm',
        // 支持 URL
        supportURL: 'https://github.com/hero553/mock-api-gm/issues',
        // 更新检查地址 - 指向 GitHub Pages（每次 push 自动更新）
        updateURL: 'https://hero553.github.io/mock-api-gm/mock-data-tool.user.js',
        // 下载地址
        downloadURL: 'https://hero553.github.io/mock-api-gm/mock-data-tool.user.js',
        // 需要的 GM 权限
        grant: [
          'GM_setValue',
          'GM_getValue',
          'GM_addStyle'
        ],
        // 在页面加载时运行 - 使用 document-start 以便尽早拦截请求
        'run-at': 'document-start',
      },
      build: {
        // 输出文件名
        fileName: 'mock-data-tool.user.js',
      },
    }),
  ],
});

