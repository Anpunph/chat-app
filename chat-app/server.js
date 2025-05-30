// 加载环境变量
try {
    require('dotenv').config();
} catch (error) {
    console.log('dotenv not loaded:', error.message);
}

const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const session = require('express-session');
const connectDB = require('./config/database');
const database = require('./database');
const jwt = require('jsonwebtoken');

// 环境变量配置
const isVercel = process.env.VERCEL === '1';
// 使用标准连接字符串而不是 SRV 格式
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://demouser:demopass123@cluster0.k8xcdx1.mongodb.net:27017/chatapp';

// 在线用户管理
const onlineUsers = new Map(); // 存储在线用户信息
const userSockets = new Map(); // 用户ID到socket ID的映射

// 房间管理
const rooms = new Map(); // 存储房间信息 {roomId: {name, description, createdBy, createdAt, users: []}}

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
    pingTimeout: 60000,
    pingInterval: 25000,
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 10e6,
    connectTimeout: 45000,
    allowEIO3: true
});

// 使用更简单的会话处理方式
let sessionConfig = {
    secret: process.env.SESSION_SECRET || 'chat-app-secret-key-' + Date.now(),
    name: 'sessionId',
    cookie: {
        secure: false, // 在开发环境中不需要HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 1天
        sameSite: 'lax'
    },
    resave: true,
    saveUninitialized: true
};

// 只有在非 Vercel 环境中使用 MongoDB 会话存储
if (!isVercel) {
    try {
        const MongoDBStore = require('connect-mongodb-session')(session);
        // 配置会话存储
        const store = new MongoDBStore({
            uri: MONGODB_URI,
            collection: 'sessions'
        });

        // 捕获存储连接错误
        store.on('error', function (error) {
            console.error('会话存储错误:', error);
        });

        sessionConfig.store = store;
    } catch (error) {
        console.warn('MongoDB 会话存储配置失败，使用内存存储:', error);
    }
}

// Configure session middleware
const sessionMiddleware = session(sessionConfig);

// Use session middleware
app.use(sessionMiddleware);

// 在app.use(sessionMiddleware)之后添加安全头设置
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
});

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for file uploads (memory storage only)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 1 // 一次只允许上传一个文件
    },
    fileFilter: function (req, file, cb) {
        // 优化文件类型检查
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('只允许上传图片、文档和压缩文件！'));
        }
    }
});

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

// 房间相关API

// 获取所有房间
app.get('/api/rooms', (req, res) => {
    try {
        const roomList = Array.from(rooms.values()).map(room => ({
            id: room.id,
            name: room.name,
            description: room.description,
            createdBy: room.createdBy,
            createdAt: room.createdAt,
            userCount: room.users ? room.users.length : 0
        }));
        res.json({ success: true, rooms: roomList });
    } catch (error) {
        console.error('获取房间列表错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 创建房间
app.post('/api/rooms', (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: '未登录' });
        }

        const { name, description } = req.body;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ success: false, message: '房间名称不能为空' });
        }

        // 生成唯一房间ID - 9位数字
        const generateRoomId = () => {
            // 生成9位随机数字
            const min = 100000000; // 最小9位数
            const max = 999999999; // 最大9位数
            const roomId = Math.floor(min + Math.random() * (max - min));

            // 确保ID唯一
            if (rooms.has(roomId.toString())) {
                return generateRoomId(); // 如果ID已存在，递归重新生成
            }

            return roomId.toString();
        };

        const roomId = generateRoomId();
        console.log('生成房间ID:', roomId);

        // 创建房间
        const room = {
            id: roomId,
            name: name.trim(),
            description: description || '',
            createdBy: req.session.user.nickname,
            createdAt: new Date(),
            users: []
        };

        rooms.set(roomId, room);

        res.json({
            success: true,
            message: '房间创建成功',
            room: {
                id: room.id,
                name: room.name,
                description: room.description,
                createdBy: room.createdBy,
                createdAt: room.createdAt
            }
        });
    } catch (error) {
        console.error('创建房间错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 获取特定房间信息
app.get('/api/rooms/:roomId', (req, res) => {
    try {
        const { roomId } = req.params;
        const room = rooms.get(roomId);

        if (!room) {
            return res.status(404).json({ success: false, message: '房间不存在' });
        }

        res.json({
            success: true,
            room: {
                id: room.id,
                name: room.name,
                description: room.description,
                createdBy: room.createdBy,
                createdAt: room.createdAt,
                userCount: room.users ? room.users.length : 0,
                users: room.users || []
            }
        });
    } catch (error) {
        console.error('获取房间信息错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
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
            // 创建 JWT token
            const token = jwt.sign(
                { id: result.user.id, nickname: result.user.nickname },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '24h' }
            );

            res.json({ success: true, token, user: result.user });
        } else {
            res.json(result);
        }
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 用户登出
app.post('/api/logout', (req, res) => {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ success: false, message: '登出失败' });
            }
            res.clearCookie('sessionId');
            res.json({ success: true, message: '登出成功' });
        });
    } else {
        res.json({ success: true, message: '登出成功' });
    }
});

// 验证中间件
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '未登录' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: '会话无效' });
    }
}

// 使用中间件保护路由
app.get('/api/user', authMiddleware, (req, res) => {
    res.json({ success: true, user: req.user });
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

// 用于测试的手动设置会话
app.post('/api/debug/set-session', async (req, res) => {
    try {
        const { nickname, password } = req.body;

        if (!nickname || !password) {
            return res.status(400).json({ success: false, message: '请提供昵称和密码' });
        }

        // 验证用户
        const result = await database.loginUser(nickname, password);

        if (result.success) {
            // 强制设置会话
            req.session.regenerate(function (err) {
                if (err) {
                    console.error('会话重新生成失败:', err);
                    return res.status(500).json({ success: false, message: '设置会话失败' });
                }

                req.session.user = result.user;
                console.log('DEBUG: 已手动设置会话用户:', req.session.user);
                console.log('DEBUG: 会话ID:', req.session.id);

                // 确保会话立即保存
                req.session.save(function (err) {
                    if (err) {
                        console.error('会话保存失败:', err);
                        return res.status(500).json({ success: false, message: '会话保存失败' });
                    }
                    console.log('DEBUG: 会话已保存:', req.session);
                    res.json({
                        success: true,
                        message: '会话已设置',
                        user: result.user,
                        sessionID: req.session.id,
                        cookie: req.session.cookie
                    });
                });
            });
        } else {
            res.status(401).json({ success: false, message: '用户验证失败' });
        }
    } catch (error) {
        console.error('设置会话错误:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// Format messages
function formatMessage(username, text, type = 'text', fileInfo = null, roomId = null) {
    return {
        username,
        text,
        type,
        fileInfo,
        roomId,
        time: new Date().toLocaleTimeString()
    };
}

// 广播在线用户列表
function broadcastOnlineUsers() {
    const users = Array.from(onlineUsers.values());
    console.log('广播在线用户列表:', users);
    io.emit('onlineUsers', users);
}

// 获取房间用户列表
function getRoomUsers(roomId) {
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room) return [];

    const users = [];
    for (const socketId of room) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket && socket.userId && socket.username) {
            users.push({
                id: socket.userId,
                nickname: socket.username
            });
        }
    }

    return users;
}

// 更新房间用户列表
function updateRoomUsers(roomId) {
    const roomUsers = getRoomUsers(roomId);

    // 更新房间对象中的用户列表
    if (rooms.has(roomId)) {
        const room = rooms.get(roomId);
        room.users = roomUsers;
        rooms.set(roomId, room);
    }

    // 广播房间用户列表
    io.to(roomId).emit('roomUsers', roomUsers);
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

            // 添加到用户映射
            userSockets.set(user.id, socket.id);

            // 设置用户状态为在线
            socket.broadcast.emit('userStatus', {
                userId: user.id,
                status: 'online'
            });

            // 广播更新的在线用户列表
            broadcastOnlineUsers();

            // 发送房间列表
            const roomList = Array.from(rooms.values()).map(room => ({
                id: room.id,
                name: room.name,
                description: room.description,
                createdBy: room.createdBy,
                createdAt: room.createdAt,
                userCount: room.users ? room.users.length : 0
            }));
            socket.emit('roomList', roomList);
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

        // 添加到用户映射
        userSockets.set(user.id, socket.id);

        // 设置用户状态为在线
        socket.broadcast.emit('userStatus', {
            userId: user.id,
            status: 'online'
        });

        // 广播更新的在线用户列表
        broadcastOnlineUsers();

        // 发送房间列表
        const roomList = Array.from(rooms.values()).map(room => ({
            id: room.id,
            name: room.name,
            description: room.description,
            createdBy: room.createdBy,
            createdAt: room.createdAt,
            userCount: room.users ? room.users.length : 0
        }));
        socket.emit('roomList', roomList);
    }

    // 创建房间
    socket.on('createRoom', (roomData, callback) => {
        try {
            console.log('收到创建房间请求:', roomData);
            console.log('当前用户:', socket.username);

            if (!socket.username) {
                console.log('创建房间失败: 用户未登录');
                return callback({ success: false, message: '未登录' });
            }

            const { name, description } = roomData;

            if (!name || name.trim().length === 0) {
                console.log('创建房间失败: 房间名称为空');
                return callback({ success: false, message: '房间名称不能为空' });
            }

            // 生成唯一房间ID - 9位数字
            const generateRoomId = () => {
                // 生成9位随机数字
                const min = 100000000; // 最小9位数
                const max = 999999999; // 最大9位数
                const roomId = Math.floor(min + Math.random() * (max - min));

                // 确保ID唯一
                if (rooms.has(roomId.toString())) {
                    return generateRoomId(); // 如果ID已存在，递归重新生成
                }

                return roomId.toString();
            };

            const roomId = generateRoomId();
            console.log('生成房间ID:', roomId);

            // 创建房间
            const room = {
                id: roomId,
                name: name.trim(),
                description: description || '',
                createdBy: socket.username,
                createdAt: new Date(),
                users: []
            };

            rooms.set(roomId, room);
            console.log('房间创建成功:', room);

            // 广播新房间信息
            io.emit('newRoom', {
                id: room.id,
                name: room.name,
                description: room.description,
                createdBy: room.createdBy,
                createdAt: room.createdAt,
                userCount: 0
            });
            console.log('已广播新房间信息');

            console.log('准备发送回调响应');
            callback({
                success: true,
                message: '房间创建成功',
                room: {
                    id: room.id,
                    name: room.name,
                    description: room.description
                }
            });
            console.log('回调响应已发送');
        } catch (error) {
            console.error('创建房间错误:', error);
            callback({ success: false, message: '创建房间失败' });
        }
    });

    // 加入房间
    socket.on('joinRoom', (roomId, callback) => {
        try {
            if (!socket.username) {
                return callback && callback({ success: false, message: '未登录' });
            }

            // 检查房间是否存在
            if (!rooms.has(roomId)) {
                return callback && callback({ success: false, message: '房间不存在' });
            }

            // 如果已经在其他房间，先离开
            if (socket.currentRoom) {
                socket.leave(socket.currentRoom);
                // 通知原房间其他用户
                socket.to(socket.currentRoom).emit('message', formatMessage('系统', `${socket.username} 离开了房间`, 'system', null, socket.currentRoom));
                // 更新原房间用户列表
                updateRoomUsers(socket.currentRoom);
            }

            // 加入新房间
            socket.join(roomId);
            socket.currentRoom = roomId;

            // 发送房间欢迎消息
            socket.emit('message', formatMessage('系统', `欢迎加入房间 ${rooms.get(roomId).name}`, 'system', null, roomId));

            // 通知房间其他用户
            socket.to(roomId).emit('message', formatMessage('系统', `${socket.username} 加入了房间`, 'system', null, roomId));

            // 更新房间用户列表
            updateRoomUsers(roomId);

            if (callback) {
                callback({
                    success: true,
                    message: '成功加入房间',
                    room: rooms.get(roomId)
                });
            }
        } catch (error) {
            console.error('加入房间错误:', error);
            if (callback) {
                callback({ success: false, message: '加入房间失败' });
            }
        }
    });

    // 离开房间
    socket.on('leaveRoom', (callback) => {
        try {
            if (!socket.currentRoom) {
                return callback && callback({ success: false, message: '未加入任何房间' });
            }

            const roomId = socket.currentRoom;

            // 通知房间其他用户
            socket.to(roomId).emit('message', formatMessage('系统', `${socket.username} 离开了房间`, 'system', null, roomId));

            // 离开房间
            socket.leave(roomId);
            socket.currentRoom = null;

            // 更新房间用户列表
            updateRoomUsers(roomId);

            if (callback) {
                callback({ success: true, message: '已离开房间' });
            }
        } catch (error) {
            console.error('离开房间错误:', error);
            if (callback) {
                callback({ success: false, message: '离开房间失败' });
            }
        }
    });

    // 获取房间列表
    socket.on('getRooms', (callback) => {
        try {
            const roomList = Array.from(rooms.values()).map(room => ({
                id: room.id,
                name: room.name,
                description: room.description,
                createdBy: room.createdBy,
                createdAt: room.createdAt,
                userCount: room.users ? room.users.length : 0
            }));

            callback({ success: true, rooms: roomList });
        } catch (error) {
            console.error('获取房间列表错误:', error);
            callback({ success: false, message: '获取房间列表失败' });
        }
    });

    // 删除房间
    socket.on('deleteRoom', (roomId, callback) => {
        console.log(`收到删除房间请求: ${roomId}, 用户: ${socket.username}`);

        // 确保回调函数存在
        if (typeof callback !== 'function') {
            console.error('删除房间错误: 回调函数未提供');
            return;
        }

        // 设置安全超时，确保回调一定会被调用
        const safetyTimeout = setTimeout(() => {
            console.log(`删除房间安全超时触发，房间ID: ${roomId}`);
            try {
                callback({
                    success: true,
                    message: '房间删除处理超时，但操作可能已成功',
                    timeout: true
                });
            } catch (err) {
                console.error('安全超时回调调用失败:', err);
            }
        }, 8000);

        try {
            if (!socket.username) {
                console.log('删除房间失败: 用户未登录');
                clearTimeout(safetyTimeout);
                callback({ success: false, message: '未登录' });
                return;
            }

            // 检查房间是否存在
            if (!rooms.has(roomId)) {
                console.log(`删除房间失败: 房间 ${roomId} 不存在`);
                clearTimeout(safetyTimeout);
                callback({ success: false, message: '房间不存在' });
                return;
            }

            const room = rooms.get(roomId);
            console.log(`房间信息: ${JSON.stringify({
                id: room.id,
                name: room.name,
                createdBy: room.createdBy
            })}`);

            // 检查是否是房间创建者
            if (room.createdBy !== socket.username) {
                console.log(`删除房间失败: 用户 ${socket.username} 不是房间 ${room.name} 的创建者`);
                clearTimeout(safetyTimeout);
                callback({ success: false, message: '只有房间创建者可以删除房间' });
                return;
            }

            try {
                // 通知所有在房间内的用户
                console.log(`通知房间 ${room.name} 内的用户房间被删除`);
                io.to(roomId).emit('message', formatMessage('系统', `房间 ${room.name} 已被创建者删除`, 'system'));

                // 让所有用户离开房间
                const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
                if (socketsInRoom) {
                    console.log(`房间 ${room.name} 中有 ${socketsInRoom.size} 个用户，让他们离开房间`);
                    for (const socketId of socketsInRoom) {
                        const clientSocket = io.sockets.sockets.get(socketId);
                        if (clientSocket) {
                            clientSocket.leave(roomId);
                            if (clientSocket.currentRoom === roomId) {
                                clientSocket.currentRoom = null;
                            }
                        }
                    }
                } else {
                    console.log(`房间 ${room.name} 中没有用户`);
                }

                // 删除房间
                console.log(`从房间列表中删除房间 ${room.name}`);
                rooms.delete(roomId);

                // 通知所有用户房间已被删除
                console.log(`广播房间 ${room.name} 已被删除的消息`);
                try {
                    io.emit('roomDeleted', { roomId, roomName: room.name });
                    console.log('广播房间删除消息成功');
                } catch (broadcastError) {
                    console.error('广播房间删除消息失败:', broadcastError);
                    // 即使广播失败，我们也认为删除成功了
                }

                console.log(`房间 ${room.name} 删除成功`);

                // 清除安全超时
                clearTimeout(safetyTimeout);

                // 确保回调函数被调用
                try {
                    callback({ success: true, message: '房间已删除' });
                } catch (callbackError) {
                    console.error('调用删除房间回调函数失败:', callbackError);
                }
            } catch (innerError) {
                console.error(`删除房间 ${room.name} 过程中出错:`, innerError);
                clearTimeout(safetyTimeout);
                callback({ success: false, message: '删除房间过程中出错: ' + innerError.message });
            }
        } catch (error) {
            console.error('删除房间错误:', error);
            clearTimeout(safetyTimeout);
            callback({ success: false, message: '删除房间失败: ' + error.message });
        }
    });

    // Listen for chatMessage
    socket.on('chatMessage', msg => {
        const currentUser = socket.username ? { nickname: socket.username } : user;
        console.log(`收到聊天消息 from ${currentUser ? currentUser.nickname : 'unknown'}:`, msg);
        if (currentUser) {
            // 如果用户在房间中，消息只发送到该房间
            if (socket.currentRoom) {
                const formattedMessage = formatMessage(currentUser.nickname, msg, 'text', null, socket.currentRoom);
                console.log('发送格式化消息到房间:', formattedMessage);
                io.to(socket.currentRoom).emit('message', formattedMessage);
            } else {
                // 用户不在房间中，提示需要先加入房间
                socket.emit('message', formatMessage('系统', '请先加入或创建一个房间', 'system'));
            }
        }
    });

    // Listen for file messages
    socket.on('fileMessage', (fileInfo) => {
        const currentUser = socket.username ? { nickname: socket.username } : user;
        console.log(`收到文件消息 from ${currentUser ? currentUser.nickname : 'unknown'}:`, fileInfo);
        if (currentUser) {
            // 如果用户在房间中，消息只发送到该房间
            if (socket.currentRoom) {
                const message = `分享了文件: ${fileInfo.originalname}`;
                const formattedMessage = formatMessage(currentUser.nickname, message, 'file', fileInfo, socket.currentRoom);
                console.log('发送文件消息到房间:', formattedMessage);
                io.to(socket.currentRoom).emit('message', formattedMessage);
            } else {
                // 用户不在房间中，提示需要先加入房间
                socket.emit('message', formatMessage('系统', '请先加入或创建一个房间', 'system'));
            }
        }
    });

    // Listen for emoji messages
    socket.on('emojiMessage', (emoji) => {
        const currentUser = socket.username ? { nickname: socket.username } : user;
        console.log(`收到表情消息 from ${currentUser ? currentUser.nickname : 'unknown'}:`, emoji);
        if (currentUser) {
            // 如果用户在房间中，消息只发送到该房间
            if (socket.currentRoom) {
                const formattedMessage = formatMessage(currentUser.nickname, emoji, 'emoji', null, socket.currentRoom);
                console.log('发送表情消息到房间:', formattedMessage);
                io.to(socket.currentRoom).emit('message', formattedMessage);
            } else {
                // 用户不在房间中，提示需要先加入房间
                socket.emit('message', formatMessage('系统', '请先加入或创建一个房间', 'system'));
            }
        }
    });

    // Listen for typing
    socket.on('typing', (isTyping) => {
        if (!socket.username) return;

        // 如果用户在房间中，只向该房间广播
        if (socket.currentRoom) {
            socket.to(socket.currentRoom).emit('userTyping', {
                username: socket.username,
                isTyping,
                roomId: socket.currentRoom
            });
        }
    });

    // Runs when client disconnects
    socket.on('disconnect', () => {
        const currentUser = socket.username ? { nickname: socket.username } : user;
        if (currentUser) {
            console.log(`用户 ${currentUser.nickname} 断开连接`);

            // 从在线用户列表中移除
            onlineUsers.delete(socket.id);

            // 如果用户在房间中，通知房间其他用户
            if (socket.currentRoom) {
                socket.to(socket.currentRoom).emit('message', formatMessage('系统', `${currentUser.nickname} 离开了房间`, 'system', null, socket.currentRoom));
                // 更新房间用户列表
                updateRoomUsers(socket.currentRoom);
            }

            // 广播更新的在线用户列表
            broadcastOnlineUsers();

            // 从用户映射中移除
            userSockets.delete(socket.userId);

            // 设置用户状态为离线
            io.emit('userStatus', {
                userId: socket.userId,
                status: 'offline'
            });
        }
    });

    // 用户离开但保持连接
    socket.on('away', () => {
        if (socket.userId) {
            // 设置用户状态为离开
            io.emit('userStatus', {
                userId: socket.userId,
                status: 'away'
            });
        }
    });

    // 用户返回
    socket.on('back', () => {
        if (socket.userId) {
            // 设置用户状态为在线
            io.emit('userStatus', {
                userId: socket.userId,
                status: 'online'
            });
        }
    });
});

// 日志处理
const logError = (error, type = 'error') => {
    console.error(`[${type}]`, error);
    if (!isVercel) {
        const logsDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        fs.appendFileSync(
            path.join(logsDir, `${type}.log`),
            `[${new Date().toISOString()}] ${error.message || error}\n${error.stack || ''}\n\n`
        );
    }
};

// 未捕获的异常处理
process.on('uncaughtException', (error) => {
    logError(error, 'uncaught');
});

// 在所有路由之后、server.listen之前添加API错误处理中间件
app.use((err, req, res, next) => {
    logError(err, 'api');
    res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? '服务器错误' : err.message
    });
});

// 连接数据库并启动服务器
const startServer = async () => {
    try {
        // 连接到MongoDB
        await connectDB();

        const PORT = process.env.PORT || 3000;
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log('Environment:', process.env.NODE_ENV);
            console.log('Vercel:', isVercel ? 'Yes' : 'No');
            console.log('MongoDB connected');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();