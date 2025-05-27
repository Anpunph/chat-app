const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const session = require('express-session');
const database = require('./database');

// 在线用户管理
const onlineUsers = new Map(); // 存储在线用户信息

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads (memory storage - no files saved to disk)
const upload = multer({
    storage: multer.memoryStorage(), // 使用内存存储，不保存到磁盘
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        // Allow common file types
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images, documents, and archives are allowed!'));
        }
    }
});

// Configure session middleware
const sessionMiddleware = session({
    secret: 'chat-app-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // 在生产环境中应该设置为true（需要HTTPS）
        maxAge: 24 * 60 * 60 * 1000 // 24小时
    }
});

// Use session middleware
app.use(sessionMiddleware);

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// File upload route (memory only - no disk storage)
app.post('/upload', (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            // Handle multer errors
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    error: '文件大小超出限制！最大允许大小为 10MB。'
                });
            } else if (err.message.includes('Only images, documents, and archives are allowed')) {
                return res.status(400).json({
                    error: '文件类型不支持！请上传图片 (JPEG, PNG, GIF)、文档 (PDF, DOC, DOCX, TXT) 或压缩包 (ZIP, RAR)。'
                });
            } else {
                return res.status(400).json({
                    error: err.message || '文件上传失败'
                });
            }
        }

        try {
            if (!req.file) {
                return res.status(400).json({ error: '没有选择文件' });
            }

            // 将文件转换为Base64数据URL（仅在内存中，不保存到磁盘）
            const base64Data = req.file.buffer.toString('base64');
            const dataUrl = `data:${req.file.mimetype};base64,${base64Data}`;

            const fileInfo = {
                originalname: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype,
                dataUrl: dataUrl, // 使用数据URL而不是文件路径
                isTemporary: true // 标记为临时文件
            };

            console.log(`文件 ${req.file.originalname} 已转换为内存数据，大小: ${req.file.size} bytes`);

            res.json({ success: true, file: fileInfo });
        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({ error: '文件上传失败' });
        }
    });
});

// 用户注册
app.post('/api/register', async (req, res) => {
    try {
        console.log('收到注册请求');
        console.log('请求体:', req.body);
        console.log('Content-Type:', req.headers['content-type']);

        const { nickname, password } = req.body;

        console.log('解析后的数据:', { nickname, password });

        if (!nickname || !password) {
            console.log('验证失败: 缺少昵称或密码');
            return res.status(400).json({ success: false, message: '请填写所有必填字段' });
        }

        if (nickname.length < 2 || nickname.length > 15) {
            console.log('验证失败: 昵称长度不符合要求');
            return res.status(400).json({ success: false, message: '昵称长度应在2-15个字符之间' });
        }

        if (password.length < 6) {
            console.log('验证失败: 密码长度不符合要求');
            return res.status(400).json({ success: false, message: '密码长度至少6个字符' });
        }

        console.log('开始注册用户:', nickname);
        const result = await database.registerUser(nickname, password);
        console.log('注册结果:', result);

        // 注册成功后不自动登录，让用户手动登录
        res.json(result);
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 用户登录
app.post('/api/login', async (req, res) => {
    try {
        console.log('收到登录请求');
        console.log('请求体:', req.body);
        console.log('Content-Type:', req.headers['content-type']);

        const { nickname, password } = req.body;

        console.log('解析后的数据:', { nickname, password });

        if (!nickname || !password) {
            console.log('验证失败: 缺少昵称或密码');
            return res.status(400).json({ success: false, message: '请输入昵称和密码' });
        }

        console.log('开始验证用户:', nickname);
        const result = await database.loginUser(nickname, password);
        console.log('验证结果:', result);

        if (result.success) {
            req.session.user = result.user;
        }

        res.json(result);
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 用户登出
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: '登出失败' });
        }
        res.json({ success: true, message: '登出成功' });
    });
});

// 获取当前用户信息
app.get('/api/user', (req, res) => {
    if (req.session.user) {
        res.json({ success: true, user: req.session.user });
    } else {
        res.status(401).json({ success: false, message: '未登录' });
    }
});

// 更新用户信息
app.post('/api/user/update', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: '未登录' });
        }

        const { nickname, oldPassword, newPassword } = req.body;
        const updates = {};

        if (nickname) {
            if (nickname.length < 2 || nickname.length > 15) {
                return res.status(400).json({ success: false, message: '昵称长度应在2-15个字符之间' });
            }
            updates.nickname = nickname;
        }

        if (newPassword) {
            if (!oldPassword) {
                return res.status(400).json({ success: false, message: '请输入当前密码' });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({ success: false, message: '新密码长度至少6个字符' });
            }

            // 验证旧密码
            const isOldPasswordValid = await database.verifyPassword(req.session.user.id, oldPassword);
            if (!isOldPasswordValid) {
                return res.status(400).json({ success: false, message: '当前密码错误' });
            }

            updates.password = newPassword;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: '没有要更新的内容' });
        }

        const result = await database.updateUser(req.session.user.id, updates);

        if (result.success) {
            req.session.user = result.user;
        }

        res.json(result);
    } catch (error) {
        console.error('更新用户信息错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// Format messages
function formatMessage(username, text, type = 'text', fileInfo = null) {
    return {
        username,
        text,
        type,
        fileInfo,
        time: new Date().toLocaleTimeString()
    };
}

// 广播在线用户列表
function broadcastOnlineUsers() {
    const users = Array.from(onlineUsers.values());
    console.log('广播在线用户列表:', users);
    io.emit('onlineUsers', users);
}

// Share session with Socket.IO
io.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res || {}, next);
});

// Run when client connects
io.on('connection', socket => {
    console.log('New connection...');
    console.log('Socket ID:', socket.id);
    console.log('Auth data:', socket.handshake.auth);

    let user = null;

    // 尝试从认证数据获取用户信息
    if (socket.handshake.auth && socket.handshake.auth.user) {
        user = socket.handshake.auth.user;
        console.log('从认证数据获取用户:', user);
    } else {
        // 尝试从会话获取用户信息
        const session = socket.request.session;
        console.log('Session:', session);
        user = session ? session.user : null;
        console.log('User from session:', user);
    }

    // 监听用户加入事件
    socket.on('userJoin', (userData) => {
        console.log('收到用户加入事件:', userData);

        // 如果用户还没有设置，才处理加入逻辑
        if (!socket.username) {
            user = userData;
            socket.userId = user.id;
            socket.username = user.nickname;

            // 添加到在线用户列表
            onlineUsers.set(socket.id, {
                id: user.id,
                nickname: user.nickname,
                socketId: socket.id
            });

            console.log(`用户 ${user.nickname} 加入聊天室`);

            // Welcome current user
            socket.emit('message', formatMessage('系统', `欢迎 ${user.nickname} 进入聊天室！`));

            // Broadcast when a user connects
            socket.broadcast.emit('message', formatMessage('系统', `${user.nickname} 加入了聊天室`));

            // 广播更新的在线用户列表
            broadcastOnlineUsers();
        }
    });

    if (user) {
        socket.userId = user.id;
        socket.username = user.nickname;

        // 添加到在线用户列表
        onlineUsers.set(socket.id, {
            id: user.id,
            nickname: user.nickname,
            socketId: socket.id
        });

        console.log(`用户 ${user.nickname} 连接到聊天室`);

        // Welcome current user
        socket.emit('message', formatMessage('系统', `欢迎 ${user.nickname} 进入聊天室！`));

        // Broadcast when a user connects
        socket.broadcast.emit('message', formatMessage('系统', `${user.nickname} 加入了聊天室`));

        // 广播更新的在线用户列表
        broadcastOnlineUsers();
    }

    // Listen for chatMessage
    socket.on('chatMessage', msg => {
        const currentUser = socket.username ? { nickname: socket.username } : user;
        console.log(`收到聊天消息 from ${currentUser ? currentUser.nickname : 'unknown'}:`, msg);
        if (currentUser) {
            const formattedMessage = formatMessage(currentUser.nickname, msg, 'text');
            console.log('发送格式化消息:', formattedMessage);
            io.emit('message', formattedMessage);
        }
    });

    // Listen for file messages
    socket.on('fileMessage', (fileInfo) => {
        const currentUser = socket.username ? { nickname: socket.username } : user;
        console.log(`收到文件消息 from ${currentUser ? currentUser.nickname : 'unknown'}:`, fileInfo);
        if (currentUser) {
            const message = `分享了文件: ${fileInfo.originalname}`;
            const formattedMessage = formatMessage(currentUser.nickname, message, 'file', fileInfo);
            console.log('发送文件消息:', formattedMessage);
            io.emit('message', formattedMessage);
        }
    });

    // Listen for emoji messages
    socket.on('emojiMessage', (emoji) => {
        const currentUser = socket.username ? { nickname: socket.username } : user;
        console.log(`收到表情消息 from ${currentUser ? currentUser.nickname : 'unknown'}:`, emoji);
        if (currentUser) {
            const formattedMessage = formatMessage(currentUser.nickname, emoji, 'emoji');
            console.log('发送表情消息:', formattedMessage);
            io.emit('message', formattedMessage);
        }
    });

    // Runs when client disconnects
    socket.on('disconnect', () => {
        const currentUser = socket.username ? { nickname: socket.username } : user;
        if (currentUser) {
            console.log(`用户 ${currentUser.nickname} 断开连接`);

            // 从在线用户列表中移除
            onlineUsers.delete(socket.id);

            // 广播离开消息
            io.emit('message', formatMessage('系统', `${currentUser.nickname} 离开了聊天室`));

            // 广播更新的在线用户列表
            broadcastOnlineUsers();
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));