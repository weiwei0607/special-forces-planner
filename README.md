# ⚡ Special Forces Planner — 特種兵行程規劃

> 極限旅遊最佳化工具 — 用最短時間玩最多景點

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript" />
  <img src="https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite" />
  <img src="https://img.shields.io/badge/Tailwind-3.x-06B6D4?logo=tailwindcss" />
  <img src="https://img.shields.io/badge/PWA-Supported-5A0FC8?logo=pwa" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg" />
</p>

---

## ✨ 功能

- **🗺️ 行程編輯器** — 逐日規劃景點、交通、用餐時間
- **📊 時間軸預覽** — 視覺化呈現每日行程動線
- **📂 行程分組** — 將行程歸類到不同旅遊主題（如「日本關西」、「韓國首爾」）
- **🔗 一鍵分享** — 產生分享連結，讓旅伴直接查看
- **💾 離線可用** — IndexedDB 本地儲存，沒網路也能用
- **📱 PWA** — 可安裝為手機桌面應用

---

## 🛠️ 技術棧

| 層 | 技術 |
|----|------|
| **框架** | React 19 + Vite |
| **語言** | TypeScript |
| **樣式** | Tailwind CSS v3 |
| **本地儲存** | Dexie (IndexedDB) |
| **圖示** | Lucide React |
| **PWA** | vite-plugin-pwa |

---

## 🚀 快速開始

```bash
cd special-forces-planner
npm install
npm run dev
```

開啟瀏覽器訪問 `http://localhost:5173`

### 建構

```bash
npm run build
```

輸出至 `dist/` 目錄，可部署至任何靜態托管服務。

---

## 📁 專案結構

```
special-forces-planner/
├── src/
│   ├── App.tsx           # 主應用路由
│   ├── db.ts             # Dexie 資料庫定義
│   ├── pages/
│   │   ├── List.tsx      # 行程列表
│   │   ├── Editor.tsx    # 行程編輯器
│   │   └── Preview.tsx   # 行程預覽
│   ├── components/       # 共用元件
│   └── utils/            # 工具函數
├── index.html
├── vite.config.ts
└── package.json
```

---

## 📝 License

MIT License © 2026
