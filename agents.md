# Agents.md — 深圳房产数据管理系统

## 项目概述

基于 Electron + Vue 3 + Element Plus 的桌面应用，用于管理和可视化深圳二手房月度成交数据。数据来源于深圳住建局公开接口和本地 JSON 文件，支持双存储（SQLite + JSON）。

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Electron 44 |
| 前端框架 | Vue 3.5 (Composition API + `<script setup>`) |
| UI 组件库 | Element Plus 2.14 |
| 图表 | ECharts 6 |
| 状态管理 | Pinia 4 |
| 路由 | Vue Router 5 (Hash 模式) |
| 数据库 | sql.js (SQLite WebAssembly) |
| HTTP 请求 | axios |
| 构建工具 | Vite 8 + vite-plugin-electron 1.x |
| 类型检查 | TypeScript 5.9 + vue-tsc 3 |
| 代码规范 | ESLint 9 (flat config) + @typescript-eslint |
| 包管理 | pnpm 12 |

## 项目结构

```
video-exchange/
├── electron/                    # Electron 主进程（Node.js 环境）
│   ├── main.ts                  # 窗口管理、IPC 路由、CSP 安全策略
│   ├── preload.ts               # contextBridge 安全暴露 API 给渲染进程
│   ├── database.ts              # SQLite 初始化、建表、默认账号
│   └── api.ts                   # 深圳住建局接口（axios 封装）
├── src/                         # Vue 3 渲染进程
│   ├── main.ts                  # 入口：注册 Pinia/Router/ElementPlus
│   ├── App.vue                  # 根组件 <router-view>
│   ├── env.d.ts                 # Window.api 全局类型声明
│   ├── types/                   # 第三方库类型补丁
│   ├── router/index.ts          # 路由表 + 登录守卫
│   ├── stores/
│   │   ├── auth.ts              # 登录态 Pinia Store
│   │   └── house.ts             # 房产数据 Pinia Store（聚合/环比/同比）
│   ├── components/
│   │   └── AppLayout.vue        # 主布局（固定侧边栏 + 头部 + 内容区）
│   ├── views/
│   │   ├── login/index.vue      # 登录页
│   │   ├── dashboard/index.vue  # 数据看板（ECharts 可视化）
│   │   ├── data-manage/index.vue # 数据管理（表格 + JSON/SQLite 导入导出 + 接口拉取）
│   │   └── settings/index.vue   # 系统设置（用户管理 + 数据统计 + 危险操作）
│   └── styles/global.scss       # 全局样式 + 工具类
├── houseData/                   # 原始 JSON 数据文件（202309.json ~ 202605.json）
├── data/                        # SQLite 数据库文件（运行时自动生成）
├── index.html                   # HTML 入口（含 CSP meta 标签）
├── vite.config.ts               # Vite + Electron 插件配置
├── tsconfig.json                # TypeScript 配置
├── eslint.config.js             # ESLint 扁平化配置
├── package.json
└── .gitignore
```

## 页面路由

| 路径 | 页面 | 认证 |
|------|------|------|
| `/login` | 登录页 | 否 |
| `/dashboard` | 数据看板 | 是 |
| `/data-manage` | 数据管理 | 是 |
| `/settings` | 系统设置 | 是 |

## 关键架构约定

### IPC 通信
- 渲染进程 → 主进程全部通过 `contextBridge` + `ipcRenderer.invoke`
- 主进程 API 注册在 `registerIpcHandlers()` 中
- 新增 IPC 通道需同步更新 `preload.ts` 和 `env.d.ts`

### 数据存储
- 数据库文件：`data/house.db`（sql.js 生成，不提交到 Git）
- JSON 文件：`houseData/*.json`（与接口返回格式一致）
- 导入导出功能保持两种存储同步

### 安全
- `contextIsolation: true`，禁用 `nodeIntegration`
- CSP 两层防护：`index.html` meta 标签 + `main.ts` session 注入
- 开发模式额外开放 `unsafe-eval`（Vite HMR 需要）和 `ws://localhost:*`
- 密码明文存储（内部工具，非生产环境）

### 样式
- 全局 SCSS 变量和工具类在 `styles/global.scss`
- 页面/组件样式使用 `<style scoped lang="scss">`
- 不使用 emoji，统一使用 `@element-plus/icons-vue`

## 常用命令

```bash
pnpm dev            # 启动开发模式（Vite + Electron）
pnpm dev:debug      # 启动调试模式（Electron 附加 --inspect=5858）
pnpm build          # 类型检查 + Vite 构建
pnpm lint           # ESLint 自动修复
pnpm lint:check     # ESLint 仅检查
pnpm electron:build # 构建 + 打包 Electron 安装包
```

## VS Code 调试

1. 终端运行 `npm run dev:debug`
2. VS Code 按 F5，选择「🖥 附加到 Electron 主进程」
3. 在 `electron/*.ts` 中打断点即可调试主进程

## 数据格式

深圳住建局接口返回格式：
```json
{
  "status": 1,
  "data": {
    "xmlDateMonth": "2026年06月",
    "dataMj": [{ "name": "南山", "value": 47540.32 }],
    "dataTs": [{ "name": "南山", "value": 420 }]
  }
}
```

数据库表结构：
- `users(id, username, password, role, created)`
- `house_data(id, year_month, district, area, count)` — UNIQUE(year_month, district)

## 注意事项

- 包管理使用 pnpm 12，构建脚本白名单在 `pnpm-workspace.yaml` 的 `allowBuilds`（electron 等允许，@parcel/watcher、electron-winstaller 已显式拒绝）
- Electron 二进制下载卡住时（国内网络），设置 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 后在 `node_modules/electron` 下执行 `node install.js`；全量重装后如发现 dist 目录为空，同样执行该命令补齐
- sql.js 和 axios 在 vite.config.ts 中标记为 external（不在主进程打包中编译）
- fdc.zjj.sz.gov.cn 的住建局接口已被瑞数 WAF 保护，主进程 axios 无法直连（返回 412），接口拉取功能目前依赖浏览器会话手动扒数据，替代方案见 houseData 目录与 opendata.sz.gov.cn
- 接口 POST 方法，不是 GET
- 接口拉取前会检查数据是否已存在，存在则弹窗确认覆盖
- houseData/*.json 与数据库按文件 mtime 自动增量同步（sync_meta 表），无需手动点导入
- 函数需要使用卫语句去返回，尽量减少使用if else增加代码分支
