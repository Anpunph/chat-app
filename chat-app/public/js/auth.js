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
            },
            passwordVisible: {
                login: false,
                register: false,
                confirmRegister: false
            },
            // 自定义弹窗数据
            showCustomAlert: false,
            customAlertMessage: '',
            customAlertIcon: 'fas fa-exclamation-circle'
        };
    },
    mounted() {
        console.log('Vue应用已挂载');
        console.log('初始表单数据:', {
            loginForm: this.loginForm,
            registerForm: this.registerForm
        });

        // 隐藏页面加载状态指示器
        this.hidePageLoader();

        // 检查是否已经登录
        this.checkLoginStatus();

        // 添加页面动画效果
        this.addPageAnimations();
    },
    methods: {
        // 隐藏页面加载状态指示器
        hidePageLoader() {
            const pageLoader = document.getElementById('pageLoader');
            if (pageLoader) {
                pageLoader.classList.add('hidden');
                setTimeout(() => {
                    pageLoader.style.display = 'none';
                }, 500);
            }
        },

        // 添加页面动画效果
        addPageAnimations() {
            // 表单输入框获得焦点时的动画
            const inputs = document.querySelectorAll('input');
            inputs.forEach(input => {
                input.addEventListener('focus', () => {
                    const icon = input.nextElementSibling;
                    if (icon) {
                        icon.style.transform = 'translateY(-2px) scale(1.1)';
                        icon.style.color = '#56ccf2';
                    }
                });

                input.addEventListener('blur', () => {
                    const icon = input.nextElementSibling;
                    if (icon) {
                        icon.style.transform = 'translateY(0) scale(1)';
                        if (!input.value) {
                            icon.style.color = '#aaa';
                        }
                    }
                });
            });

            // 添加标签切换动画
            const tabs = document.querySelectorAll('.auth-tab');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tab.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        tab.style.transform = 'scale(1)';
                    }, 150);
                });
            });
        },

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

            // 添加按钮加载动画
            const loginButton = document.querySelector('.auth-form.active .auth-button');
            if (loginButton) {
                loginButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 登录中...';
            }

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

                    // 添加成功动画
                    if (loginButton) {
                        loginButton.innerHTML = '<i class="fas fa-check-circle"></i> 登录成功';
                        loginButton.style.background = 'linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%)';
                    }

                    // 延迟跳转，让用户看到成功消息
                    setTimeout(() => {
                        // 添加页面过渡效果
                        document.body.classList.add('page-transition');

                        // 预加载主页
                        const preloadLink = document.createElement('link');
                        preloadLink.rel = 'preload';
                        preloadLink.href = '/';
                        preloadLink.as = 'document';
                        document.head.appendChild(preloadLink);

                        // 延迟后跳转
                        setTimeout(() => {
                            window.location.href = '/';
                        }, 300);
                    }, 800);
                } else {
                    ElMessage({
                        message: data.message || '登录失败',
                        type: 'error'
                    });

                    // 恢复按钮状态
                    if (loginButton) {
                        loginButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> 登录';
                        loginButton.style.background = 'linear-gradient(135deg, #56ccf2 0%, #2f80ed 100%)';
                    }
                }
            } catch (error) {
                console.error('登录错误:', error);
                ElMessage({
                    message: '网络错误，请稍后重试',
                    type: 'error'
                });

                // 恢复按钮状态
                if (loginButton) {
                    loginButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> 登录';
                    loginButton.style.background = 'linear-gradient(135deg, #56ccf2 0%, #2f80ed 100%)';
                }
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

            // 添加按钮加载动画
            const registerButton = document.querySelector('.auth-form.active .auth-button');
            if (registerButton) {
                registerButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 注册中...';
            }

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

                    // 添加成功动画
                    if (registerButton) {
                        registerButton.innerHTML = '<i class="fas fa-check-circle"></i> 注册成功';
                        registerButton.style.background = 'linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%)';
                    }

                    // 清空注册表单
                    this.registerForm.nickname = '';
                    this.registerForm.password = '';
                    this.registerForm.confirmPassword = '';

                    // 延迟切换到登录标签页
                    setTimeout(() => {
                        // 切换到登录标签页
                        this.activeTab = 'login';

                        // 将昵称填入登录表单
                        this.loginForm.nickname = data.user.nickname;
                        this.loginForm.password = '';

                        // 恢复按钮样式
                        if (registerButton) {
                            registerButton.innerHTML = '<i class="fas fa-user-plus"></i> 注册';
                            registerButton.style.background = 'linear-gradient(135deg, #56ccf2 0%, #2f80ed 100%)';
                        }
                    }, 1000);
                } else {
                    // 检查是否是昵称已存在的错误
                    if (data.message && (data.message.includes('昵称已存在') || data.message.includes('已被使用'))) {
                        // 使用自定义弹窗提示昵称已存在
                        this.showAlert('该昵称已被注册，请更换一个新昵称', 'fas fa-user-times');
                    } else {
                        // 其他错误使用 ElementUI 消息提示
                        ElMessage({
                            message: data.message || '注册失败',
                            type: 'error'
                        });
                    }

                    // 恢复按钮状态
                    if (registerButton) {
                        registerButton.innerHTML = '<i class="fas fa-user-plus"></i> 注册';
                        registerButton.style.background = 'linear-gradient(135deg, #56ccf2 0%, #2f80ed 100%)';
                    }
                }
            } catch (error) {
                console.error('注册错误:', error);
                ElMessage({
                    message: '网络错误，请稍后重试',
                    type: 'error'
                });

                // 恢复按钮状态
                if (registerButton) {
                    registerButton.innerHTML = '<i class="fas fa-user-plus"></i> 注册';
                    registerButton.style.background = 'linear-gradient(135deg, #56ccf2 0%, #2f80ed 100%)';
                }
            } finally {
                this.registerLoading = false;
            }
        },

        goToChat() {
            window.location.href = '/';
        },

        togglePasswordVisibility(field) {
            // 切换密码可见性状态
            this.passwordVisible[field] = !this.passwordVisible[field];

            // 获取对应的图标元素
            const iconElement = event.currentTarget;

            // 获取相应的密码输入框（直接从事件目标的父元素中查找）
            const formGroup = iconElement.closest('.form-group');
            const inputField = formGroup.querySelector('input');

            if (inputField) {
                // 切换输入框类型
                inputField.type = this.passwordVisible[field] ? 'text' : 'password';

                // 切换图标
                if (this.passwordVisible[field]) {
                    iconElement.classList.remove('fa-eye');
                    iconElement.classList.add('fa-eye-slash');
                } else {
                    iconElement.classList.remove('fa-eye-slash');
                    iconElement.classList.add('fa-eye');
                }
            }
        },

        // 显示自定义弹窗
        showAlert(message, icon = 'fas fa-exclamation-circle') {
            this.customAlertMessage = message;
            this.customAlertIcon = icon;
            this.showCustomAlert = true;

            // 添加弹窗动画效果
            document.body.style.overflow = 'hidden'; // 防止背景滚动
        },

        // 关闭自定义弹窗
        closeCustomAlert() {
            this.showCustomAlert = false;
            document.body.style.overflow = ''; // 恢复背景滚动
        }
    }
}).mount('#app');
