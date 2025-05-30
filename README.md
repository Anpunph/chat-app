# 清语聊天室

## 项目介绍
清语聊天室是一个现代化的在线聊天应用，提供实时通讯、多房间聊天、文件共享等功能。项目采用Vue 3和Element Plus构建，为用户提供流畅、美观的聊天体验。

## 功能特点
- 🔐 用户认证系统（注册/登录）
- 💬 实时消息通讯
- 🏠 多房间聊天支持
- 📁 文件共享功能
- 🎨 美观的用户界面
- ✨ 流畅的页面过渡效果
- 📱 响应式设计

## 技术栈
- 前端框架：Vue.js 3
- UI组件库：Element Plus
- 状态管理：Vuex 4
- 路由管理：Vue Router 4
- 实时通讯：Socket.io
- 开发工具：Vite
- CSS预处理器：SCSS

## 安装说明

### 环境要求
- Node.js >= 14.0.0
- npm >= 6.0.0

### 安装步骤

1. 克隆项目
```bash
git clone [项目地址]
cd chat-app
```

2. 安装依赖
```bash
npm install
```

3. 启动开发服务器
```bash
npm run dev
```

4. 启动后端服务器（需要单独运行）
```bash
npm run server
```

## 启动项目

1. 进入项目目录：
```bash
cd chat-app
```

2. 启动服务器：
```bash
node server.js
```

服务器将在默认端口启动。您也可以通过设置环境变量 PORT 来指定其他端口。

## 使用说明

1. 注册/登录：
   - 首次使用需要注册账号
   - 使用注册的账号和密码登录系统

2. 进入聊天室：
   - 登录后可以选择已有聊天室或创建新的聊天室
   - 支持同时加入多个聊天室

3. 聊天功能：
   - 发送文本消息
   - 分享文件
   - 查看在线用户列表
   - 房间切换

## 开发说明

### 项目结构
```
chat-app/
├── src/
│   ├── assets/      # 静态资源
│   ├── components/  # 组件
│   ├── views/       # 页面
│   ├── router/      # 路由配置
│   ├── store/       # 状态管理
│   ├── api/         # API接口
│   └── utils/       # 工具函数
├── server/          # 后端服务
└── public/          # 公共资源
```

### 开发命令
```bash
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
npm run preview  # 预览生产版本
npm run server   # 启动后端服务器
```

## 贡献指南
欢迎提交问题和改进建议！请遵循以下步骤：
1. Fork 本仓库
2. 创建您的特性分支 (git checkout -b feature/AmazingFeature)
3. 提交您的更改 (git commit -m 'Add some AmazingFeature')
4. 推送到分支 (git push origin feature/AmazingFeature)
5. 打开一个 Pull Request

## 许可证
本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详细信息。

## 联系方式
如有任何问题或建议，请通过以下方式联系我们：
- 项目Issues
- 电子邮件：[项目维护者邮箱]

## 致谢
感谢所有为本项目做出贡献的开发者！
