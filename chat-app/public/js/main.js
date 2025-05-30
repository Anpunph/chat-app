// Initialize Vue app
const { createApp } = Vue;
const { ElMessage } = ElementPlus;

const app = createApp({
    data() {
        return {
            user: null,
            showUserSettings: false,
            showOnlineMembers: false,
            showRoomSelector: false,
            onlineUsers: [],
            updateLoading: false,
            userForm: {
                nickname: '',
                oldPassword: '',
                newPassword: '',
                confirmPassword: ''
            },
            rooms: [],
            roomForm: {
                name: '',
                description: ''
            },
            createRoomLoading: false,
            selectedRoom: null,
            showCreateRoom: false,
            searchQuery: '',
            showDeleteConfirm: false,
            roomToDelete: null
        };
    },
    computed: {
        filteredRooms() {
            if (!this.searchQuery) return this.rooms;

            const query = this.searchQuery.toLowerCase().trim();
            return this.rooms.filter(room => {
                // 按房间名称搜索
                const nameMatch = room.name.toLowerCase().includes(query);

                // 按房间ID搜索
                const idMatch = room.id.toLowerCase().includes(query);

                // 按描述搜索
                const descMatch = room.description && room.description.toLowerCase().includes(query);

                // 按创建者搜索
                const creatorMatch = room.createdBy && room.createdBy.toLowerCase().includes(query);

                return nameMatch || idMatch || descMatch || creatorMatch;
            });
        }
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
                        this.showRoomSelector = true;
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
                },
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 30000,
                forceNew: false,
                transports: ['websocket', 'polling']
            });

            this.socket.on('connect', () => {
                console.log('Socket连接成功, ID:', this.socket.id);
                // 连接成功后发送用户信息
                this.socket.emit('userJoin', this.user);
            });

            this.socket.on('disconnect', () => {
                console.log('Socket连接断开');
            });

            this.socket.on('connect_error', (error) => {
                console.error('Socket连接错误:', error);
            });

            this.socket.on('connect_timeout', () => {
                console.error('Socket连接超时');
            });

            this.socket.on('reconnect', (attemptNumber) => {
                console.log(`Socket重连成功，尝试次数: ${attemptNumber}`);
            });

            this.socket.on('reconnect_attempt', (attemptNumber) => {
                console.log(`Socket尝试重连，次数: ${attemptNumber}`);
            });

            this.socket.on('reconnect_error', (error) => {
                console.error('Socket重连错误:', error);
            });

            this.socket.on('reconnect_failed', () => {
                console.error('Socket重连失败');
                ElMessage({
                    message: '服务器连接失败，请刷新页面重试',
                    type: 'error',
                    duration: 0,
                    showClose: true
                });
            });

            // 监听在线用户列表更新
            this.socket.on('onlineUsers', (users) => {
                console.log('收到在线用户列表:', users);
                this.onlineUsers = users;
            });

            // 监听房间删除事件
            this.socket.on('roomDeleted', (data) => {
                console.log('收到房间删除通知:', data);

                // 如果当前在被删除的房间中，则返回房间列表
                if (this.selectedRoom && this.selectedRoom.id === data.roomId) {
                    this.selectedRoom = null;
                    this.showRoomSelector = true;
                    this.chatMessages.innerHTML = '';

                    // 显示提示
                    this.showSystemToast(`房间 "${data.roomName}" 已被创建者删除`);
                }

                // 刷新房间列表
                this.refreshRooms();
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
            // 使用防抖处理消息发送
            this.sendMessageDebounced = this.debounce((msg) => {
                console.log('发送消息到服务器:', msg);
                this.socket.emit('chatMessage', msg);
            }, 300);

            // 修改Message submit事件处理
            this.chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const msg = e.target.elements.msg.value.trim();
                if (msg) {
                    this.sendMessageDebounced(msg);
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

            // 添加输入状态指示
            const msgInput = document.getElementById('msg');
            let typingTimeout = null;

            msgInput.addEventListener('input', () => {
                if (!typingTimeout) {
                    // 通知服务器用户正在输入
                    this.socket.emit('typing', true);
                }

                // 清除之前的超时
                clearTimeout(typingTimeout);

                // 设置新的超时，1.5秒后停止输入状态
                typingTimeout = setTimeout(() => {
                    this.socket.emit('typing', false);
                    typingTimeout = null;
                }, 1500);
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
        },

        // 在methods对象中添加防抖函数
        debounce(func, wait) {
            let timeout;
            return function (...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        },

        // 创建新房间
        createRoom() {
            console.log('创建房间函数被调用');
            if (this.createRoomLoading) {
                console.log('已经在创建房间中，忽略请求');
                return;
            }

            if (!this.roomForm.name || this.roomForm.name.trim().length === 0) {
                console.log('房间名称为空');
                ElMessage({
                    message: '请输入房间名称',
                    type: 'warning'
                });
                return;
            }

            console.log('开始创建房间:', this.roomForm);
            this.createRoomLoading = true;

            // 使用Promise包装socket.emit
            const emitPromise = new Promise((resolve, reject) => {
                // 设置超时
                const timeout = setTimeout(() => {
                    reject(new Error('创建房间超时'));
                }, 10000);

                this.socket.emit('createRoom', this.roomForm, (response) => {
                    clearTimeout(timeout);
                    if (response && response.success) {
                        resolve(response);
                    } else {
                        reject(new Error(response ? response.message : '创建房间失败'));
                    }
                });
            });

            // 处理Promise
            emitPromise.then(response => {
                console.log('创建房间成功，准备加入房间');
                this.createRoomLoading = false;
                this.showCreateRoom = false;
                this.roomForm.name = '';
                this.roomForm.description = '';

                // 自动加入创建的房间
                this.joinRoom(response.room.id);
            }).catch(error => {
                console.error('创建房间失败:', error.message);
                this.createRoomLoading = false;
                ElMessage({
                    message: '创建房间失败: ' + error.message,
                    type: 'error'
                });
            });
        },

        // 加入房间
        joinRoom(roomId) {
            console.log('准备加入房间:', roomId);

            // 使用Promise包装socket.emit
            const emitPromise = new Promise((resolve, reject) => {
                // 设置超时
                const timeout = setTimeout(() => {
                    reject(new Error('加入房间超时'));
                }, 10000);

                this.socket.emit('joinRoom', roomId, (response) => {
                    clearTimeout(timeout);
                    if (response && response.success) {
                        resolve(response);
                    } else {
                        reject(new Error(response ? response.message : '加入房间失败'));
                    }
                });
            });

            // 处理Promise
            emitPromise.then(response => {
                console.log('成功加入房间:', response.room);
                // 更新当前房间
                this.selectedRoom = response.room;

                // 隐藏房间选择器
                this.showRoomSelector = false;

                // 清空聊天区域
                this.chatMessages.innerHTML = '';

                // 显示欢迎消息
                this.showWelcomeToast(`已加入房间: ${response.room.name}`);
            }).catch(error => {
                console.error('加入房间失败:', error.message);
                this.createRoomLoading = false; // 重置创建房间状态
                ElMessage({
                    message: '加入房间失败: ' + error.message,
                    type: 'error'
                });
            });
        },

        // 离开房间
        leaveRoom() {
            this.socket.emit('leaveRoom', (response) => {
                if (response.success) {
                    // 重置当前房间
                    this.selectedRoom = null;

                    // 显示房间选择器
                    this.showRoomSelector = true;

                    // 清空聊天区域
                    this.chatMessages.innerHTML = '';
                } else {
                    ElMessage({
                        message: response.message || '离开房间失败',
                        type: 'error'
                    });
                }
            });
        },

        // 刷新房间列表
        refreshRooms() {
            console.log('开始刷新房间列表');

            // 设置超时
            const timeout = setTimeout(() => {
                console.log('刷新房间列表超时');
                ElMessage({
                    message: '获取房间列表超时，请刷新页面重试',
                    type: 'warning'
                });
            }, 5000);

            this.socket.emit('getRooms', (response) => {
                // 清除超时
                clearTimeout(timeout);

                if (response && response.success) {
                    console.log('获取房间列表成功，房间数量:', response.rooms.length);
                    this.rooms = response.rooms;
                } else {
                    console.error('获取房间列表失败:', response ? response.message : '未知错误');
                    ElMessage({
                        message: response && response.message ? response.message : '获取房间列表失败',
                        type: 'error'
                    });

                    // 如果获取失败，尝试使用本地列表
                    if (this.rooms.length === 0) {
                        console.log('本地房间列表为空，无法恢复');
                    } else {
                        console.log('使用本地房间列表，房间数量:', this.rooms.length);
                    }
                }
            });
        },

        // 删除房间
        deleteRoom(roomId) {
            // 阻止事件冒泡
            event.stopPropagation();

            console.log(`请求删除房间: ${roomId}`);

            // 查找房间
            const room = this.rooms.find(r => r.id === roomId);
            if (!room) {
                console.error(`房间不存在: ${roomId}`);
                ElMessage({
                    message: '房间不存在',
                    type: 'error'
                });
                return;
            }

            // 确认是否是房间创建者
            console.log(`房间创建者: ${room.createdBy}, 当前用户: ${this.user.nickname}`);
            if (room.createdBy !== this.user.nickname) {
                console.error(`用户 ${this.user.nickname} 不是房间 ${room.name} 的创建者`);
                ElMessage({
                    message: '只有房间创建者可以删除房间',
                    type: 'warning'
                });
                return;
            }

            // 显示自定义确认弹窗
            this.roomToDelete = room;
            this.showDeleteConfirm = true;
            console.log(`显示删除确认弹窗, 房间: ${room.name}`);
        },

        // 取消删除房间
        cancelDeleteRoom() {
            this.showDeleteConfirm = false;
            this.roomToDelete = null;
        },

        // 确认删除房间
        confirmDeleteRoom() {
            if (!this.roomToDelete) {
                console.error('没有要删除的房间');
                return;
            }

            const roomId = this.roomToDelete.id;
            const roomName = this.roomToDelete.name;

            console.log(`准备删除房间: ${roomName} (ID: ${roomId})`);

            // 先关闭确认弹窗，防止用户重复点击
            this.showDeleteConfirm = false;

            // 显示加载提示
            const loadingMessage = ElMessage({
                message: '正在删除房间...',
                type: 'info',
                duration: 0
            });

            // 设置超时 - 增加到10秒
            const timeout = setTimeout(() => {
                loadingMessage.close();
                console.log('删除房间操作超时，尝试本地删除');

                ElMessage({
                    message: '服务器响应超时，已在本地删除房间',
                    type: 'warning'
                });

                // 超时后直接在本地删除房间
                this.handleLocalRoomDeletion(roomId);
                this.roomToDelete = null;
            }, 10000); // 增加到10秒

            console.log(`发送删除房间请求到服务器, 房间ID: ${roomId}`);

            // 发送删除请求
            this.socket.emit('deleteRoom', roomId, (response) => {
                // 清除超时
                clearTimeout(timeout);

                // 关闭加载提示
                loadingMessage.close();

                console.log('收到删除房间响应:', response);

                if (response && response.success) {
                    console.log(`房间 ${roomName} 删除成功`);

                    ElMessage({
                        message: '房间已成功删除',
                        type: 'success'
                    });

                    // 如果当前在被删除的房间中，则返回房间列表
                    if (this.selectedRoom && this.selectedRoom.id === roomId) {
                        console.log('用户当前在被删除的房间中，返回房间列表');
                        this.selectedRoom = null;
                        this.showRoomSelector = true;
                        this.chatMessages.innerHTML = '';
                    }

                    // 从本地房间列表中移除该房间
                    const index = this.rooms.findIndex(r => r.id === roomId);
                    if (index !== -1) {
                        console.log(`从本地列表中删除房间, 索引: ${index}`);
                        this.rooms.splice(index, 1);
                    }

                    // 刷新房间列表
                    console.log('刷新房间列表');
                    this.refreshRooms();
                } else {
                    console.error('删除房间失败:', response ? response.message : '未知错误');

                    ElMessage({
                        message: response && response.message ? response.message : '删除房间失败',
                        type: 'error'
                    });

                    // 即使服务器删除失败，也尝试从本地列表中移除
                    this.handleLocalRoomDeletion(roomId);
                }

                // 重置状态
                this.roomToDelete = null;
            });
        },

        // 处理本地房间删除（当服务器回调失败时使用）
        handleLocalRoomDeletion(roomId) {
            console.log('尝试本地删除房间:', roomId);

            // 从本地房间列表中移除该房间
            const index = this.rooms.findIndex(r => r.id === roomId);
            if (index !== -1) {
                console.log('在本地列表中找到房间，正在删除');
                this.rooms.splice(index, 1);

                // 如果当前在被删除的房间中，则返回房间列表
                if (this.selectedRoom && this.selectedRoom.id === roomId) {
                    console.log('用户当前在被删除的房间中，返回房间列表');
                    this.selectedRoom = null;
                    this.showRoomSelector = true;
                    this.chatMessages.innerHTML = '';
                }

                // 刷新房间列表视图（不请求服务器）
                console.log('本地删除成功，强制更新视图');
                this.$forceUpdate();

                ElMessage({
                    message: '房间已从本地列表中移除',
                    type: 'warning'
                });
            } else {
                console.log('房间在本地列表中不存在');
            }
        }
    }
});

// Mount Vue app
app.mount('#app');