const { createApp } = Vue;
const { ElMessage } = ElementPlus;

createApp({
    data() {
        return {
            activeTab: 'login',
            loginLoading: false,
            registerLoading: false,
            loginForm: {
                nickname: '',
                password: ''
            },
            registerForm: {
                nickname: '',
                password: '',
                confirmPassword: ''
            }
        };
    },
    mounted() {
        console.log('Vue应用已挂载');
        console.log('初始表单数据:', {
            loginForm: this.loginForm,
            registerForm: this.registerForm
        });
        // 检查是否已经登录
        this.checkLoginStatus();
    },
    methods: {
        async checkLoginStatus() {
            try {
                const response = await fetch('/api/user');
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        // 已登录，跳转到聊天室
                        window.location.href = '/';
                    }
                }
            } catch (error) {
                console.log('检查登录状态失败:', error);
            }
        },

        async handleLogin() {
            console.log('登录表单数据:', this.loginForm);

            if (!this.loginForm.nickname || !this.loginForm.password) {
                console.log('登录验证失败:', {
                    nickname: this.loginForm.nickname,
                    password: this.loginForm.password
                });
                ElMessage({
                    message: '请填写昵称和密码',
                    type: 'warning'
                });
                return;
            }

            this.loginLoading = true;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        nickname: this.loginForm.nickname,
                        password: this.loginForm.password
                    })
                });

                const data = await response.json();

                if (data.success) {
                    ElMessage({
                        message: '登录成功！',
                        type: 'success'
                    });

                    // 延迟跳转，让用户看到成功消息
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 1000);
                } else {
                    ElMessage({
                        message: data.message || '登录失败',
                        type: 'error'
                    });
                }
            } catch (error) {
                console.error('登录错误:', error);
                ElMessage({
                    message: '网络错误，请稍后重试',
                    type: 'error'
                });
            } finally {
                this.loginLoading = false;
            }
        },

        async handleRegister() {
            // 调试信息
            console.log('注册表单数据:', this.registerForm);

            // 表单验证
            if (!this.registerForm.nickname || !this.registerForm.password || !this.registerForm.confirmPassword) {
                console.log('表单验证失败:', {
                    nickname: this.registerForm.nickname,
                    password: this.registerForm.password,
                    confirmPassword: this.registerForm.confirmPassword
                });
                ElMessage({
                    message: '请填写所有字段',
                    type: 'warning'
                });
                return;
            }

            if (this.registerForm.nickname.length < 2 || this.registerForm.nickname.length > 15) {
                ElMessage({
                    message: '昵称长度应在2-15个字符之间',
                    type: 'warning'
                });
                return;
            }

            if (this.registerForm.password.length < 6) {
                ElMessage({
                    message: '密码长度至少6个字符',
                    type: 'warning'
                });
                return;
            }

            if (this.registerForm.password !== this.registerForm.confirmPassword) {
                ElMessage({
                    message: '两次输入的密码不一致',
                    type: 'warning'
                });
                return;
            }

            this.registerLoading = true;

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        nickname: this.registerForm.nickname,
                        password: this.registerForm.password
                    })
                });

                const data = await response.json();

                if (data.success) {
                    ElMessage({
                        message: '注册成功！请登录',
                        type: 'success',
                        duration: 3000
                    });

                    // 清空注册表单
                    this.registerForm.nickname = '';
                    this.registerForm.password = '';
                    this.registerForm.confirmPassword = '';

                    // 切换到登录标签页
                    this.activeTab = 'login';

                    // 将昵称填入登录表单
                    this.loginForm.nickname = data.user.nickname;
                    this.loginForm.password = '';
                } else {
                    ElMessage({
                        message: data.message || '注册失败',
                        type: 'error'
                    });
                }
            } catch (error) {
                console.error('注册错误:', error);
                ElMessage({
                    message: '网络错误，请稍后重试',
                    type: 'error'
                });
            } finally {
                this.registerLoading = false;
            }
        },

        goToChat() {
            window.location.href = '/';
        }
    }
}).mount('#app');
