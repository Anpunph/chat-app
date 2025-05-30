const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    nickname: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 2,
        maxlength: 15
    },
    password: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date
    },
    status: {
        type: String,
        enum: ['online', 'offline', 'away'],
        default: 'offline'
    }
});

// 密码加密中间件
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// 验证密码方法
userSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// 更新时间中间件
userSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const User = mongoose.model('User', userSchema);

module.exports = User; 