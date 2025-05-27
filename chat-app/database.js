const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'users.json');
        this.ensureDataDirectory();
        this.users = this.loadUsers();
    }

    ensureDataDirectory() {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    loadUsers() {
        try {
            if (fs.existsSync(this.dbPath)) {
                const data = fs.readFileSync(this.dbPath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('加载用户数据失败:', error);
        }
        return [];
    }

    saveUsers() {
        try {
            fs.writeFileSync(this.dbPath, JSON.stringify(this.users, null, 2));
            return true;
        } catch (error) {
            console.error('保存用户数据失败:', error);
            return false;
        }
    }

    // 注册新用户
    async registerUser(nickname, password) {
        try {
            // 检查昵称是否已存在
            if (this.users.find(user => user.nickname === nickname)) {
                return { success: false, message: '昵称已存在' };
            }

            // 加密密码
            const hashedPassword = await bcrypt.hash(password, 10);

            // 创建新用户
            const newUser = {
                id: Date.now().toString(),
                nickname,
                password: hashedPassword,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            this.users.push(newUser);

            if (this.saveUsers()) {
                return {
                    success: true,
                    message: '注册成功',
                    user: {
                        id: newUser.id,
                        nickname: newUser.nickname
                    }
                };
            } else {
                return { success: false, message: '保存用户数据失败' };
            }
        } catch (error) {
            console.error('注册用户失败:', error);
            return { success: false, message: '注册失败' };
        }
    }

    // 用户登录
    async loginUser(nickname, password) {
        try {
            const user = this.users.find(u => u.nickname === nickname);
            if (!user) {
                return { success: false, message: '昵称或密码错误' };
            }

            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return { success: false, message: '昵称或密码错误' };
            }

            return {
                success: true,
                message: '登录成功',
                user: {
                    id: user.id,
                    nickname: user.nickname
                }
            };
        } catch (error) {
            console.error('用户登录失败:', error);
            return { success: false, message: '登录失败' };
        }
    }

    // 根据ID获取用户
    getUserById(id) {
        const user = this.users.find(u => u.id === id);
        if (user) {
            return {
                id: user.id,
                nickname: user.nickname
            };
        }
        return null;
    }

    // 更新用户信息
    async updateUser(id, updates) {
        try {
            const userIndex = this.users.findIndex(u => u.id === id);
            if (userIndex === -1) {
                return { success: false, message: '用户不存在' };
            }

            const user = this.users[userIndex];

            // 如果要更新昵称，检查是否已存在
            if (updates.nickname && updates.nickname !== user.nickname) {
                if (this.users.find(u => u.nickname === updates.nickname && u.id !== id)) {
                    return { success: false, message: '昵称已存在' };
                }
                user.nickname = updates.nickname;
            }

            // 如果要更新密码
            if (updates.password) {
                user.password = await bcrypt.hash(updates.password, 10);
            }

            user.updatedAt = new Date().toISOString();

            if (this.saveUsers()) {
                return {
                    success: true,
                    message: '更新成功',
                    user: {
                        id: user.id,
                        nickname: user.nickname
                    }
                };
            } else {
                return { success: false, message: '保存数据失败' };
            }
        } catch (error) {
            console.error('更新用户失败:', error);
            return { success: false, message: '更新失败' };
        }
    }

    // 验证旧密码
    async verifyPassword(id, password) {
        try {
            const user = this.users.find(u => u.id === id);
            if (!user) {
                return false;
            }
            return await bcrypt.compare(password, user.password);
        } catch (error) {
            console.error('验证密码失败:', error);
            return false;
        }
    }
}

module.exports = new Database();
