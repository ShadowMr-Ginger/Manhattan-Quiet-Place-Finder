# Manhattan Quiet Place Finder
# 曼哈顿安静地点查找器

> A polished frontend prototype for discovering quiet places in Manhattan — ideal for studying, working, coding, or focused productivity.
> 一个精致的前端原型，用于发现曼哈顿的安静地点 —— 适合学习、工作、编程或专注生产力。

---

## ✨ Features / 功能特性

| Feature | Description |
|---------|-------------|
| **Interactive Map** / 交互式地图 | Manhattan street grid with clickable markers, or real Google Maps when API key is provided. 带有可点击标记的曼哈顿街道网格，或提供 API Key 后切换为真实 Google Maps。 |
| **Search & Filters** / 搜索与筛选 | Search by address, filter by place type (Cafe / Library / Coworking / Public), minimum quiet score slider, sort by distance or score. 按地址搜索，按地点类型筛选（咖啡馆/图书馆/共享办公/公共区域），最低安静分数滑块，按距离或分数排序。 |
| **AI Chat Assistant** / AI 聊天助手 | Beautiful chat UI with typewriter animation and mock AI responses. 精美的聊天界面，带打字机动画和模拟 AI 回复。 |
| **Place Details** / 地点详情 | Quiet score, occupancy, opening hours, crowd status, and future quiet score prediction chart. 安静分数、 occupancy、开放时间、拥挤状态和未来安静分数预测图表。 |
| **User Profile** / 用户资料 | Click avatar to view favorites and saved places. 点击头像查看收藏和已保存地点。 |
| **Responsive Design** / 响应式设计 | Modern glassmorphism UI with smooth Framer Motion animations. 现代毛玻璃 UI，配合流畅的 Framer Motion 动画。 |

---

## 🛠 Tech Stack / 技术栈

- **Next.js 16** + **React 19** + **TypeScript**
- **Tailwind CSS 4** — Utility-first styling / 原子化样式
- **Framer Motion** — Animations / 动画
- **Lucide React** — Icons / 图标
- **@vis.gl/react-google-maps** — Google Maps integration / Google Maps 集成

---

## 📦 Installation / 安装

### Prerequisites / 前置要求

- [Node.js](https://nodejs.org/) >= 18
- npm (comes with Node.js) / npm (随 Node.js 附带)

### Steps / 步骤

```bash
# 1. Clone the repository / 克隆仓库
git clone <your-repo-url>
cd Manhattan-Quiet-Place-Finder

# 2. Install dependencies / 安装依赖
npm install

# 3. (Optional) Configure Google Maps API Key / （可选）配置 Google Maps API Key
#    See the Environment Variables section below / 请参阅下方的环境变量章节
```

---

## 🚀 Running Locally / 本地运行

```bash
# Start the development server / 启动开发服务器
npm run dev
```

Then open your browser and visit: / 然后在浏览器中打开：

```
http://localhost:3000
```

The app will automatically reload when you edit any file. / 当你编辑任何文件时，应用会自动重新加载。

### Available Scripts / 可用脚本

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload / 启动带热重载的开发服务器 |
| `npm run build` | Build for production / 构建生产版本 |
| `npm run start` | Start production server / 启动生产服务器 |
| `npm run lint` | Run ESLint / 运行 ESLint 代码检查 |

---

## 🔑 Environment Variables / 环境变量

To use **real Google Maps** instead of the stylized fallback map, create a `.env.local` file in the project root: / 若要使用**真实的 Google Maps** 替代风格化降级地图，请在项目根目录创建 `.env.local` 文件：

```bash
# .env.local
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

> **How to get an API Key?** / **如何获取 API Key？**  
> Visit [Google Cloud Console → Credentials](https://console.cloud.google.com/google/maps-apis/credentials) and enable the **Maps JavaScript API**. / 访问 [Google Cloud Console → Credentials](https://console.cloud.google.com/google/maps-apis/credentials) 并启用 **Maps JavaScript API**。

If no API key is provided, the app will gracefully fall back to a beautiful stylized Manhattan map. / 如果未提供 API Key，应用将优雅地降级为精美的风格化曼哈顿地图。

---

## 📁 Project Structure / 项目结构

```
├── src/
│   ├── app/
│   │   ├── globals.css          # Global styles / 全局样式
│   │   ├── layout.tsx           # Root layout / 根布局
│   │   └── page.tsx             # Main page (3-column layout) / 主页面（三栏布局）
│   ├── components/
│   │   ├── ChatPanel.tsx        # AI chat with typewriter effect / 带打字机效果的 AI 聊天
│   │   ├── Filters.tsx          # Search filters (type, score, sort) / 搜索筛选器
│   │   ├── Map.tsx              # Interactive map (Google Maps + fallback) / 交互式地图
│   │   ├── PlaceDetailPanel.tsx # Place detail view / 地点详情视图
│   │   ├── ProfileModal.tsx     # User profile modal / 用户资料弹窗
│   │   ├── QuietPlaceCard.tsx   # Search result card / 搜索结果卡片
│   │   ├── QuietScoreChart.tsx  # Quiet score prediction chart / 安静分数预测图表
│   │   ├── SearchBar.tsx        # Search input / 搜索输入框
│   │   └── Sidebar.tsx          # Left sidebar / 左侧边栏
│   ├── data/
│   │   └── mockQuietPlaces.ts   # 10 Manhattan quiet places mock data / 10 个曼哈顿安静地点模拟数据
│   └── types/
│       └── quietPlace.ts        # TypeScript type definitions / TypeScript 类型定义
├── .env.local.example           # Environment variable template / 环境变量模板
├── next.config.ts               # Next.js configuration / Next.js 配置
└── package.json
```

---

## 🗺 Mock Data / 模拟数据

The app includes **10 realistic Manhattan quiet places** with: / 应用包含 **10 个真实的曼哈顿安静地点**，带有：

- Realistic coordinates (latitude / longitude) / 真实坐标（经纬度）
- Quiet score (0–100) / 安静分数（0–100）
- Current occupancy & capacity / 当前 occupancy 和容量
- Crowdedness status / 拥挤状态
- Opening hours / 开放时间
- Future quiet score predictions (next 5 hours) / 未来安静分数预测（未来 5 小时）

No backend is required for this prototype. / 此原型无需后端。

---

## 🎯 Future Enhancements / 未来扩展

- 🔗 Integrate real backend API for live data / 接入真实后端 API 获取实时数据
- 🤖 Connect to real Generative AI (OpenAI / Claude) for the chat assistant / 接入真实生成式 AI（OpenAI / Claude）作为聊天助手
- 📸 Add photo integration (Google Places Photos API) / 添加照片集成（Google Places Photos API）
- 🌗 Dark mode toggle / 深色模式切换
- 📱 Mobile responsive refinements / 移动端响应式优化

---

## 📝 License / 许可证

This is a course project prototype. / 这是一个课程项目原型。
