const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['text', 'file', 'emoji', 'system'],
        default: 'text'
    },
    content: {
        type: String,
        required: true
    },
    fileInfo: {
        originalname: String,
        mimetype: String,
        size: Number,
        dataUrl: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// 创建复合索引
messageSchema.index({ roomId: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message; 