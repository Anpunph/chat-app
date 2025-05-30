const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // 使用标准连接字符串而不是 SRV 格式
        const mongoURI = process.env.MONGODB_URI || 'mongodb://demouser:demopass123@cluster0.k8xcdx1.mongodb.net:27017/chatapp';

        // 在 Vercel 环境中尝试本地内存数据存储
        const isVercel = process.env.VERCEL === '1';
        if (isVercel) {
            console.log('在 Vercel 环境中运行，使用本地存储');
            return null;
        }

        const conn = await mongoose.connect(mongoURI);
        console.log(`MongoDB 连接成功: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error('MongoDB 连接失败:', error);
        console.log('继续使用本地存储...');
        return null;
    }
};

module.exports = connectDB; 