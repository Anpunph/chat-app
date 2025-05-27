// Initialize Vue app
const { createApp } = Vue;
const { ElMessage } = ElementPlus;

const app = createApp({
    data() {
        return {
            user: null,
            showUserSettings: false,
            showOnlineMembers: false,
            onlineUsers: [],
            updateLoading: false,
            userForm: {
                nickname: '',
                oldPassword: '',
                newPassword: '',
                confirmPassword: ''
            }
        };
    },
    async mounted() {
        console.log('Vue应用已挂载');
        await this.checkLoginStatus();
        if (this.user) {
            console.log('用户已登录，初始化聊天功能');
            this.initializeChat();
        }
    },
    methods: {
        async checkLoginStatus() {
            try {
                const response = await fetch('/api/user');
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        this.user = data.user;
                        this.userForm.nickname = data.user.nickname;
                    } else {
                        // 未登录，跳转到登录页面
                        window.location.href = '/auth.html';
                    }
                } else {
                    window.location.href = '/auth.html';
                }
            } catch (error) {
                console.error('检查登录状态失败:', error);
                window.location.href = '/auth.html';
            }
        },

        async handleLogout() {
            try {
                const response = await fetch('/api/logout', {
                    method: 'POST'
                });

                if (response.ok) {
                    ElMessage({
                        message: '已退出登录',
                        type: 'success'
                    });
                    setTimeout(() => {
                        window.location.href = '/auth.html';
                    }, 1000);
                }
            } catch (error) {
                console.error('退出登录失败:', error);
                ElMessage({
                    message: '退出登录失败',
                    type: 'error'
                });
            }
        },

        async handleUpdateUser() {
            // 表单验证
            if (this.userForm.newPassword && !this.userForm.oldPassword) {
                ElMessage({
                    message: '修改密码时请输入当前密码',
                    type: 'warning'
                });
                return;
            }

            if (this.userForm.newPassword && this.userForm.newPassword !== this.userForm.confirmPassword) {
                ElMessage({
                    message: '两次输入的新密码不一致',
                    type: 'warning'
                });
                return;
            }

            if (this.userForm.nickname.length < 2 || this.userForm.nickname.length > 15) {
                ElMessage({
                    message: '昵称长度应在2-15个字符之间',
                    type: 'warning'
                });
                return;
            }

            this.updateLoading = true;

            try {
                const updateData = {
                    nickname: this.userForm.nickname
                };

                if (this.userForm.newPassword) {
                    updateData.oldPassword = this.userForm.oldPassword;
                    updateData.newPassword = this.userForm.newPassword;
                }

                const response = await fetch('/api/user/update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(updateData)
                });

                const data = await response.json();

                if (data.success) {
                    this.user = data.user;
                    this.userForm.nickname = data.user.nickname;
                    this.userForm.oldPassword = '';
                    this.userForm.newPassword = '';
                    this.userForm.confirmPassword = '';
                    this.showUserSettings = false;

                    ElMessage({
                        message: '用户信息更新成功',
                        type: 'success'
                    });
                } else {
                    ElMessage({
                        message: data.message || '更新失败',
                        type: 'error'
                    });
                }
            } catch (error) {
                console.error('更新用户信息失败:', error);
                ElMessage({
                    message: '网络错误，请稍后重试',
                    type: 'error'
                });
            } finally {
                this.updateLoading = false;
            }
        },

        initializeChat() {
            // 原有的聊天功能初始化
            this.setupChatElements();
            this.setupSocketConnection();
            this.setupEventListeners();
        },

        // 显示Toast通用函数
        showToast(message, icon = '👋', bgColor = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', duration = 3000) {
            const welcomeToast = document.getElementById('welcome-toast');
            const welcomeText = document.querySelector('.welcome-text');
            const welcomeIcon = document.querySelector('.welcome-icon');

            if (welcomeToast && welcomeText && welcomeIcon) {
                welcomeText.textContent = message;
                welcomeIcon.textContent = icon;
                welcomeToast.style.background = bgColor;
                welcomeToast.classList.remove('hidden', 'fade-out');

                // 短暂延迟后显示动画
                setTimeout(() => {
                    welcomeToast.classList.add('show');
                }, 100);

                // 指定时间后开始淡出
                setTimeout(() => {
                    welcomeToast.classList.add('fade-out');
                    welcomeToast.classList.remove('show');
                }, duration);

                // 淡出动画完成后隐藏
                setTimeout(() => {
                    welcomeToast.classList.add('hidden');
                    welcomeToast.classList.remove('fade-out');
                }, duration + 800);
            }
        },

        // 显示欢迎提示
        showWelcomeToast(message) {
            this.showToast(message, '👋', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 3000);
        },

        // 显示离开提示
        showLeaveToast(message) {
            this.showToast(message, '👋', 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)', 2500);
        },

        // 显示加入提示
        showJoinToast(message) {
            this.showToast(message, '🎉', 'linear-gradient(135deg, #26de81 0%, #20bf6b 100%)', 2500);
        },

        // 显示系统提示
        showSystemToast(message) {
            this.showToast(message, 'ℹ️', 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)', 3000);
        },

        setupChatElements() {
            this.chatForm = document.getElementById('chat-form');
            this.chatMessages = document.querySelector('.chat-messages');
            this.emojiBtn = document.getElementById('emoji-btn');
            this.emojiPicker = document.getElementById('emoji-picker');
            this.fileBtn = document.getElementById('file-btn');
            this.fileInput = document.getElementById('file-input');
            this.uploadProgress = document.getElementById('upload-progress');
            this.progressFill = document.querySelector('.progress-fill');
            this.progressText = document.querySelector('.progress-text');
        },

        setupSocketConnection() {
            console.log('设置Socket连接...');
            console.log('当前用户:', this.user);

            // 连接Socket并传递用户信息
            this.socket = io({
                auth: {
                    user: this.user
                }
            });

            this.socket.on('connect', () => {
                console.log('Socket连接成功');
                // 连接成功后发送用户信息
                this.socket.emit('userJoin', this.user);
            });

            this.socket.on('disconnect', () => {
                console.log('Socket连接断开');
            });

            // 监听在线用户列表更新
            this.socket.on('onlineUsers', (users) => {
                console.log('收到在线用户列表:', users);
                this.onlineUsers = users;
            });

            // Message from server
            this.socket.on('message', message => {
                console.log('收到消息:', message);

                // 检查是否是系统消息，如果是则显示为Toast而不是聊天消息
                if (message.username === '系统') {
                    if (message.text.includes('欢迎') && message.text.includes('进入聊天室')) {
                        // 欢迎消息
                        this.showWelcomeToast(message.text);
                    } else if (message.text.includes('离开了聊天室')) {
                        // 离开消息
                        this.showLeaveToast(message.text);
                    } else if (message.text.includes('加入了聊天室')) {
                        // 加入消息
                        this.showJoinToast(message.text);
                    } else {
                        // 其他系统消息显示为Toast
                        this.showSystemToast(message.text);
                    }
                } else {
                    // 普通消息显示在聊天区域
                    this.outputMessage(message);

                    // Scroll down
                    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
                }
            });
        },

        setupEventListeners() {
            // Message submit
            this.chatForm.addEventListener('submit', (e) => {
                e.preventDefault();

                // Get message text
                const msg = e.target.elements.msg.value.trim();
                console.log('准备发送消息:', msg);

                if (msg) {
                    // Emit message to server
                    console.log('发送消息到服务器:', msg);
                    this.socket.emit('chatMessage', msg);

                    // Clear input
                    e.target.elements.msg.value = '';
                }

                e.target.elements.msg.focus();
            });

            // Emoji button click
            this.emojiBtn.addEventListener('click', () => {
                this.emojiPicker.classList.toggle('hidden');
            });

            // Emoji selection
            this.emojiPicker.addEventListener('click', (e) => {
                if (e.target.classList.contains('emoji')) {
                    const emoji = e.target.dataset.emoji;
                    this.socket.emit('emojiMessage', emoji);
                    this.emojiPicker.classList.add('hidden');
                }
            });

            // File button click
            this.fileBtn.addEventListener('click', () => {
                this.fileInput.click();
            });

            // File input change
            this.fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.handleFileUpload(file);
                }
            });

            // Close emoji picker when clicking outside
            document.addEventListener('click', (e) => {
                if (!this.emojiBtn.contains(e.target) && !this.emojiPicker.contains(e.target)) {
                    this.emojiPicker.classList.add('hidden');
                }
            });
        },

        async handleFileUpload(file) {
            // Check file size (10MB limit)
            const maxSize = 10 * 1024 * 1024; // 10MB in bytes
            if (file.size > maxSize) {
                ElMessage({
                    message: `文件大小超出限制！最大允许大小为 10MB，您的文件为 ${this.formatFileSize(file.size)}。`,
                    type: 'error',
                    duration: 4000,
                    showClose: true
                });
                this.fileInput.value = ''; // Reset file input
                return;
            }

            // Check file type
            const allowedTypes = /\.(jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar)$/i;
            if (!allowedTypes.test(file.name)) {
                ElMessage({
                    message: '文件类型不支持！请上传图片 (JPEG, PNG, GIF)、文档 (PDF, DOC, DOCX, TXT) 或压缩包 (ZIP, RAR)。',
                    type: 'error',
                    duration: 4000,
                    showClose: true
                });
                this.fileInput.value = ''; // Reset file input
                return;
            }

            await this.uploadFile(file);
        },

        async uploadFile(file) {
            const formData = new FormData();
            formData.append('file', file);

            // Show upload progress
            this.uploadProgress.classList.remove('hidden');
            this.progressFill.style.width = '0%';
            this.progressFill.style.background = '#4a69bd'; // Reset to normal color
            this.progressText.textContent = '上传中...';
            this.progressText.style.color = '#495057'; // Reset to normal color

            try {
                const response = await fetch('/upload', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const result = await response.json();

                    // Simulate progress for better UX
                    this.progressFill.style.width = '100%';
                    this.progressText.textContent = '上传完成！';

                    // Show success message
                    ElMessage({
                        message: `文件 "${result.file.originalname}" 上传成功！`,
                        type: 'success',
                        duration: 2000,
                        showClose: true
                    });

                    // Send file message to server
                    this.socket.emit('fileMessage', result.file);

                    // Hide progress after a short delay
                    setTimeout(() => {
                        this.uploadProgress.classList.add('hidden');
                    }, 1000);
                } else {
                    // Handle server errors
                    const errorData = await response.json().catch(() => ({ error: '上传失败' }));
                    throw new Error(errorData.error || '上传失败');
                }
            } catch (error) {
                console.error('Upload error:', error);

                // Show error message with ElementUI Plus
                ElMessage({
                    message: error.message || '文件上传失败！',
                    type: 'error',
                    duration: 4000,
                    showClose: true
                });

                // Reset progress bar
                this.progressFill.style.width = '0%';
                this.uploadProgress.classList.add('hidden');
            }

            // Reset file input
            this.fileInput.value = '';
        },

        // Format file size
        formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },

        // Check if file is an image
        isImage(mimetype) {
            return mimetype.startsWith('image/');
        },

        // Output message to DOM
        outputMessage(message) {
            const div = document.createElement('div');
            div.classList.add('message');

            // 判断是否是当前用户发送的消息
            const isOwnMessage = message.username === this.user.nickname;

            // 添加自己消息或他人消息的类
            if (isOwnMessage) {
                div.classList.add('own-message');
            } else {
                div.classList.add('other-message');
            }

            // Add specific class based on message type
            if (message.type === 'file') {
                div.classList.add('file-message');
            } else if (message.type === 'emoji') {
                div.classList.add('emoji-message');
            }

            let messageContent = '';

            if (message.type === 'emoji') {
                messageContent = `
                    <div class="message-header">
                        <span class="username">${message.username}:</span>
                        <span class="timestamp">${message.time}</span>
                    </div>
                    <div class="message-content emoji-content ${isOwnMessage ? 'own-bubble' : 'other-bubble'}">${message.text}</div>
                `;
            } else if (message.type === 'file' && message.fileInfo) {
                const fileInfo = message.fileInfo;
                const fileSize = this.formatFileSize(fileInfo.size);

                // 使用数据URL而不是文件路径
                const fileSource = fileInfo.dataUrl || fileInfo.path;

                messageContent = `
                    <div class="message-header">
                        <span class="username">${message.username}:</span>
                        <span class="timestamp">${message.time}</span>
                    </div>
                    <div class="message-content file-content ${isOwnMessage ? 'own-bubble' : 'other-bubble'}">
                        <span class="file-text">${message.text}</span>
                        <div class="file-info">
                            <div class="file-link-container">
                                📎 ${fileInfo.originalname}
                                <span class="file-size">(${fileSize})</span>
                                ${fileInfo.isTemporary ? '<span class="temp-file-notice">临时文件</span>' : ''}
                            </div>
                            ${this.isImage(fileInfo.mimetype) ?
                                `<br><img src="${fileSource}" alt="${fileInfo.originalname}" class="file-preview">` :
                                `<br><div class="file-placeholder">
                                    <span class="file-icon">📄</span>
                                    <span class="file-name">${fileInfo.originalname}</span>
                                    <span class="file-type">${fileInfo.mimetype}</span>
                                </div>`
                            }
                        </div>
                    </div>
                `;
            } else {
                messageContent = `
                    <div class="message-header">
                        <span class="username">${message.username}:</span>
                        <span class="timestamp">${message.time}</span>
                    </div>
                    <div class="message-content text-content ${isOwnMessage ? 'own-bubble' : 'other-bubble'}">${message.text}</div>
                `;
            }

            div.innerHTML = messageContent;
            this.chatMessages.appendChild(div);
        }
    }
});

// Mount Vue app
app.mount('#app');