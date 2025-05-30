const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Message = require('./models/Message');
const Room = require('./models/Room');

class Database {
    constructor() {
        this.isVercel = process.env.VERCEL === '1';

        // 内存存储
        this.inMemoryUsers = [];
        this.inMemoryMessages = [];
        this.inMemoryRooms = [];

        // 添加一个默认用户方便测试
        this.addDefaultUser();
    }

    // 添加默认用户
    async addDefaultUser() {
        try {
            // 检查默认用户是否已存在
            if (this.isVercel) {
                if (!this.inMemoryUsers.find(u => u.nickname === 'demo')) {
                    await this.registerUser('demo', 'demo123');
                    console.log('已创建默认用户: demo/demo123');
                }
            } else {
                const User = require('./models/User');
                const existingUser = await User.findOne({ nickname: 'demo' });
                if (!existingUser) {
                    const user = new User({
                        nickname: 'demo',
                        password: 'demo123'
                    });
                    await user.save();
                    console.log('已创建默认用户: demo/demo123');
                }
            }
        } catch (error) {
            console.error('创建默认用户失败:', error);
        }
    }

    // 用户注册
    async registerUser(nickname, password) {
        try {
            if (this.isVercel) {
                // 内存存储实现
                if (this.inMemoryUsers.find(u => u.nickname === nickname)) {
                    return { success: false, message: '昵称已存在' };
                }

                const bcrypt = require('bcryptjs');
                const hashedPassword = await bcrypt.hash(password, 10);

                const newUser = {
                    _id: Date.now().toString(),
                    nickname,
                    password: hashedPassword,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                this.inMemoryUsers.push(newUser);

                return {
                    success: true,
                    message: '注册成功',
                    user: {
                        id: newUser._id,
                        nickname: newUser.nickname
                    }
                };
            } else {
                // MongoDB 实现
                // 检查昵称是否已存在
                const existingUser = await User.findOne({ nickname });
                if (existingUser) {
                    return { success: false, message: '昵称已存在' };
                }

                // 创建新用户
                const user = new User({
                    nickname,
                    password
                });

                await user.save();

                return {
                    success: true,
                    message: '注册成功',
                    user: {
                        id: user._id,
                        nickname: user.nickname
                    }
                };
            }
        } catch (error) {
            console.error('注册用户失败:', error);
            return { success: false, message: '注册失败' };
        }
    }

    // 用户登录
    async loginUser(nickname, password) {
        try {
            if (this.isVercel) {
                // 内存存储实现
                const user = this.inMemoryUsers.find(u => u.nickname === nickname);
                if (!user) {
                    return { success: false, message: '昵称或密码错误' };
                }

                const bcrypt = require('bcryptjs');
                const isPasswordValid = await bcrypt.compare(password, user.password);
                if (!isPasswordValid) {
                    return { success: false, message: '昵称或密码错误' };
                }

                user.lastLogin = new Date();
                user.status = 'online';

                return {
                    success: true,
                    message: '登录成功',
                    user: {
                        id: user._id,
                        nickname: user.nickname
                    }
                };
            } else {
                // MongoDB 实现
                const user = await User.findOne({ nickname });
                if (!user) {
                    return { success: false, message: '昵称或密码错误' };
                }

                const isPasswordValid = await user.comparePassword(password);
                if (!isPasswordValid) {
                    return { success: false, message: '昵称或密码错误' };
                }

                // 更新最后登录时间和状态
                user.lastLogin = new Date();
                user.status = 'online';
                await user.save();

                return {
                    success: true,
                    message: '登录成功',
                    user: {
                        id: user._id,
                        nickname: user.nickname
                    }
                };
            }
        } catch (error) {
            console.error('用户登录失败:', error);
            return { success: false, message: '登录失败' };
        }
    }

    // 根据ID获取用户
    async getUserById(id) {
        try {
            if (this.isVercel) {
                // 内存存储实现
                const user = this.inMemoryUsers.find(u => u._id.toString() === id.toString());
                if (user) {
                    return {
                        success: true,
                        user: {
                            id: user._id,
                            nickname: user.nickname
                        }
                    };
                }
            } else {
                // MongoDB 实现
                const user = await User.findById(id);
                if (user) {
                    return {
                        success: true,
                        user: {
                            id: user._id,
                            nickname: user.nickname
                        }
                    };
                }
            }
            console.log('未找到用户ID:', id);
            return { success: false, message: '用户不存在' };
        } catch (error) {
            console.error('获取用户失败:', error);
            return { success: false, message: '获取用户失败' };
        }
    }

    // 更新用户信息
    async updateUser(id, updates) {
        try {
            if (this.isVercel) {
                // 内存存储实现
                const userIndex = this.inMemoryUsers.findIndex(u => u._id.toString() === id.toString());
                if (userIndex === -1) {
                    return { success: false, message: '用户不存在' };
                }

                const user = this.inMemoryUsers[userIndex];

                // 如果要更新昵称，检查是否已存在
                if (updates.nickname && updates.nickname !== user.nickname) {
                    const existingUser = this.inMemoryUsers.find(u =>
                        u.nickname === updates.nickname &&
                        u._id.toString() !== id.toString()
                    );

                    if (existingUser) {
                        return { success: false, message: '昵称已存在' };
                    }

                    user.nickname = updates.nickname;
                }

                // 如果要更新密码
                if (updates.password) {
                    const bcrypt = require('bcryptjs');
                    user.password = await bcrypt.hash(updates.password, 10);
                }

                user.updatedAt = new Date();

                return {
                    success: true,
                    message: '更新成功',
                    user: {
                        id: user._id,
                        nickname: user.nickname
                    }
                };
            } else {
                // MongoDB 实现
                const user = await User.findById(id);
                if (!user) {
                    return { success: false, message: '用户不存在' };
                }

                // 如果要更新昵称，检查是否已存在
                if (updates.nickname && updates.nickname !== user.nickname) {
                    const existingUser = await User.findOne({
                        nickname: updates.nickname,
                        _id: { $ne: id }
                    });
                    if (existingUser) {
                        return { success: false, message: '昵称已存在' };
                    }
                    user.nickname = updates.nickname;
                }

                // 如果要更新密码
                if (updates.password) {
                    user.password = updates.password;
                }

                await user.save();

                return {
                    success: true,
                    message: '更新成功',
                    user: {
                        id: user._id,
                        nickname: user.nickname
                    }
                };
            }
        } catch (error) {
            console.error('更新用户失败:', error);
            return { success: false, message: '更新失败' };
        }
    }

    // 验证旧密码
    async verifyPassword(id, password) {
        try {
            if (this.isVercel) {
                // 内存存储实现
                const user = this.inMemoryUsers.find(u => u._id.toString() === id.toString());
                if (!user) {
                    return false;
                }
                const bcrypt = require('bcryptjs');
                return await bcrypt.compare(password, user.password);
            } else {
                // MongoDB 实现
                const user = await User.findById(id);
                if (!user) {
                    return false;
                }
                return await user.comparePassword(password);
            }
        } catch (error) {
            console.error('验证密码失败:', error);
            return false;
        }
    }

    // 备份数据
    backupData() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(__dirname, 'data', `users-backup-${timestamp}.json`);
            fs.copyFileSync(this.dbPath, backupPath);

            // 保留最近10个备份
            this.cleanupOldBackups();

            return true;
        } catch (error) {
            console.error('数据备份失败:', error);
            return false;
        }
    }

    // 清理旧备份
    cleanupOldBackups() {
        try {
            const dataDir = path.join(__dirname, 'data');
            const backupFiles = fs.readdirSync(dataDir)
                .filter(file => file.startsWith('users-backup-'))
                .sort((a, b) => {
                    // 按时间戳排序，最新的在前
                    return fs.statSync(path.join(dataDir, b)).mtime.getTime() -
                        fs.statSync(path.join(dataDir, a)).mtime.getTime();
                });

            // 删除旧备份，只保留最近10个
            if (backupFiles.length > 10) {
                backupFiles.slice(10).forEach(file => {
                    fs.unlinkSync(path.join(dataDir, file));
                });
            }
        } catch (error) {
            console.error('清理旧备份失败:', error);
        }
    }

    // 保存消息
    async saveMessage(message) {
        try {
            if (this.isVercel) {
                // 内存存储实现
                const newMessage = {
                    _id: Date.now().toString(),
                    roomId: message.roomId,
                    sender: message.sender,
                    type: message.type,
                    content: message.text,
                    fileInfo: message.fileInfo,
                    createdAt: new Date()
                };

                // 最多保存1000条消息
                if (this.inMemoryMessages.length >= 1000) {
                    this.inMemoryMessages.shift(); // 移除最旧的消息
                }

                this.inMemoryMessages.push(newMessage);
                return true;
            } else {
                // MongoDB 实现
                const newMessage = new Message({
                    roomId: message.roomId,
                    sender: message.sender,
                    type: message.type,
                    content: message.text,
                    fileInfo: message.fileInfo
                });

                await newMessage.save();
                return true;
            }
        } catch (error) {
            console.error('保存消息失败:', error);
            return false;
        }
    }

    // 获取房间最近消息
    async getRoomMessages(roomId, limit = 50) {
        try {
            if (this.isVercel) {
                // 内存存储实现
                const messages = this.inMemoryMessages
                    .filter(m => m.roomId === roomId)
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, limit);

                // 查找发送者
                const messagesWithSender = messages.map(m => {
                    const sender = this.inMemoryUsers.find(u => u._id.toString() === m.sender.toString());
                    return {
                        ...m,
                        sender: { nickname: sender ? sender.nickname : '未知用户' }
                    };
                });

                return messagesWithSender.reverse();
            } else {
                // MongoDB 实现
                const messages = await Message.find({ roomId })
                    .sort({ createdAt: -1 })
                    .limit(limit)
                    .populate('sender', 'nickname')
                    .lean();

                return messages.reverse();
            }
        } catch (error) {
            console.error('获取房间消息失败:', error);
            return [];
        }
    }

    // 创建房间
    async createRoom(name, description, userId) {
        try {
            if (this.isVercel) {
                // 内存存储实现
                const room = {
                    _id: Date.now().toString(),
                    name,
                    description: description || '',
                    createdBy: userId,
                    users: [userId],
                    createdAt: new Date(),
                    isActive: true,
                    lastActivity: new Date()
                };

                this.inMemoryRooms.push(room);

                return {
                    success: true,
                    room: {
                        id: room._id,
                        name: room.name,
                        description: room.description,
                        createdBy: userId,
                        createdAt: room.createdAt
                    }
                };
            } else {
                // MongoDB 实现
                const room = new Room({
                    name,
                    description,
                    createdBy: userId,
                    users: [userId]
                });

                await room.save();
                return {
                    success: true,
                    room: {
                        id: room._id,
                        name: room.name,
                        description: room.description,
                        createdBy: userId,
                        createdAt: room.createdAt
                    }
                };
            }
        } catch (error) {
            console.error('创建房间失败:', error);
            return { success: false, message: '创建房间失败' };
        }
    }

    // 获取所有房间
    async getRooms() {
        try {
            if (this.isVercel) {
                // 内存存储实现
                return this.inMemoryRooms
                    .filter(room => room.isActive)
                    .map(room => {
                        // 查找创建者和用户信息
                        const createdByUser = this.inMemoryUsers.find(u => u._id.toString() === room.createdBy.toString());
                        const users = room.users.map(userId => {
                            const user = this.inMemoryUsers.find(u => u._id.toString() === userId.toString());
                            return user ? { id: user._id, nickname: user.nickname } : null;
                        }).filter(Boolean);

                        return {
                            id: room._id,
                            name: room.name,
                            description: room.description,
                            createdBy: createdByUser ? createdByUser.nickname : '未知用户',
                            createdAt: room.createdAt,
                            userCount: users.length,
                            users
                        };
                    })
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            } else {
                // MongoDB 实现
                const rooms = await Room.find({ isActive: true })
                    .populate('createdBy', 'nickname')
                    .populate('users', 'nickname')
                    .sort({ createdAt: -1 })
                    .lean();

                return rooms.map(room => ({
                    id: room._id,
                    name: room.name,
                    description: room.description,
                    createdBy: room.createdBy.nickname,
                    createdAt: room.createdAt,
                    userCount: room.users.length,
                    users: room.users.map(user => ({
                        id: user._id,
                        nickname: user.nickname
                    }))
                }));
            }
        } catch (error) {
            console.error('获取房间列表失败:', error);
            return [];
        }
    }

    // 加入房间
    async joinRoom(roomId, userId) {
        try {
            if (this.isVercel) {
                // 内存存储实现
                const room = this.inMemoryRooms.find(r => r._id.toString() === roomId.toString());
                if (!room) {
                    return { success: false, message: '房间不存在' };
                }

                if (!room.users.includes(userId)) {
                    room.users.push(userId);
                    room.lastActivity = new Date();
                }

                return { success: true, message: '加入房间成功' };
            } else {
                // MongoDB 实现
                const room = await Room.findById(roomId);
                if (!room) {
                    return { success: false, message: '房间不存在' };
                }

                if (!room.users.includes(userId)) {
                    room.users.push(userId);
                    room.lastActivity = new Date();
                    await room.save();
                }

                return { success: true, message: '加入房间成功' };
            }
        } catch (error) {
            console.error('加入房间失败:', error);
            return { success: false, message: '加入房间失败' };
        }
    }

    // 离开房间
    async leaveRoom(roomId, userId) {
        try {
            if (this.isVercel) {
                // 内存存储实现
                const room = this.inMemoryRooms.find(r => r._id.toString() === roomId.toString());
                if (!room) {
                    return { success: false, message: '房间不存在' };
                }

                room.users = room.users.filter(id => id.toString() !== userId.toString());
                room.lastActivity = new Date();

                return { success: true, message: '离开房间成功' };
            } else {
                // MongoDB 实现
                const room = await Room.findById(roomId);
                if (!room) {
                    return { success: false, message: '房间不存在' };
                }

                room.users = room.users.filter(id => id.toString() !== userId.toString());
                room.lastActivity = new Date();
                await room.save();

                return { success: true, message: '离开房间成功' };
            }
        } catch (error) {
            console.error('离开房间失败:', error);
            return { success: false, message: '离开房间失败' };
        }
    }

    // 删除房间
    async deleteRoom(roomId, userId) {
        try {
            if (this.isVercel) {
                // 内存存储实现
                const roomIndex = this.inMemoryRooms.findIndex(r =>
                    r._id.toString() === roomId.toString() &&
                    r.createdBy.toString() === userId.toString()
                );

                if (roomIndex === -1) {
                    return { success: false, message: '房间不存在或无权限删除' };
                }

                this.inMemoryRooms[roomIndex].isActive = false;

                return { success: true, message: '房间删除成功' };
            } else {
                // MongoDB 实现
                const room = await Room.findOne({
                    _id: roomId,
                    createdBy: userId
                });

                if (!room) {
                    return { success: false, message: '房间不存在或无权限删除' };
                }

                room.isActive = false;
                await room.save();

                return { success: true, message: '房间删除成功' };
            }
        } catch (error) {
            console.error('删除房间失败:', error);
            return { success: false, message: '删除房间失败' };
        }
    }
}

module.exports = new Database();
