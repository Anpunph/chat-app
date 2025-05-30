const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 50
    },
    description: {
        type: String,
        trim: true,
        maxlength: 200
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    users: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    lastActivity: {
        type: Date,
        default: Date.now
    }
});

// 创建索引
roomSchema.index({ name: 'text', description: 'text' });
roomSchema.index({ createdAt: -1 });
roomSchema.index({ isActive: 1 });

const Room = mongoose.model('Room', roomSchema);

module.exports = Room; 