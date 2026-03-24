// 全局配置
const API_BASE_URL = 'http://127.0.0.1:8000/api';
const WS_BASE_URL = 'ws://127.0.0.1:8000/api/chat/ws';

// 创建Axios实例
const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // 调整超时时间到30秒，与后端模型调用超时匹配
    headers: {
        'Content-Type': 'application/json'
    }
});

// 添加响应拦截器，用于调试
axiosInstance.interceptors.response.use(
    response => {
        console.log('API响应:', response.config.url, response.status, response.data);
        return response;
    },
    error => {
        console.error('API响应错误:', error.config?.url, error.response?.status, error.response?.data);
        return Promise.reject(error);
    }
);

// 添加请求拦截器，自动添加token
axiosInstance.interceptors.request.use(
    config => {
        const token = localStorage.getItem('token');
        console.log('当前请求URL:', config.url);
        console.log('当前token:', token);
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            console.log('已添加Authorization头:', config.headers.Authorization);
        }
        return config;
    },
    error => {
        return Promise.reject(error);
    }
);

// Vue 3应用
const { createApp } = Vue;

const app = createApp({
    data() {
        return {
            // 用户状态
            isLoggedIn: false,
            user: null,
            activeTab: 'login',
            loginForm: {
                username: '',
                password: ''
            },
            registerForm: {
                username: '',
                email: '',
                password: '',
                name: '',
                user_type: 'individual'
            },
            loginRules: {
                username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
                password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
            },
            registerRules: {
                username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
                email: [{ required: true, type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }],
                password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
                name: [{ required: true, message: '请输入姓名', trigger: 'blur' }]
            },
            loginFormRef: null,
            registerFormRef: null,
            
            // 滑块验证码相关
            sliderCaptcha: {
                background: '',
                slider: '',
                slider_width: 60,
                slider_height: 60,
                gap_x: 0,
                gap_y: 0,
                is_open: false
            },
            sliderX: 0,
            sliderY: 0,
            sliderVerified: false,
            isSliding: false,
            startX: 0,
            dragStartX: 0,
            sliderStatus: 'default', // default, success, error
            sliderMessage: '按住左边按钮拖动完成上方拼图',
            
            // 聊天状态
            chatRooms: [],
            availableRooms: [],
            currentChatRoom: null,
            messages: [],
            newMessage: '',
            ws: null,
            
            // 大模型分析结果
            keyInformation: null,
            
            // AI助手聊天状态
            aiChatMessages: [],
            aiChatInput: '',
            aiChatLoading: false,
            
            // 合同状态
            contracts: [],
            currentContract: null,
            contractContent: '',
            contractForm: {
                title: '',
                template_type: 'sales',
                party_a: '',
                party_b: '',
                subject: '',
                amount: '',
                term: '',
                location: ''
            },
            contractRules: {
                title: [{ required: true, message: '请输入合同名称', trigger: 'blur' }],
                template_type: [{ required: true, message: '请选择合同类型', trigger: 'change' }],
                party_a: [{ required: true, message: '请输入甲方名称', trigger: 'blur' }],
                party_b: [{ required: true, message: '请输入乙方名称', trigger: 'blur' }],
                subject: [{ required: true, message: '请输入合同标的', trigger: 'blur' }]
            },
            contractFormRef: null,
            
            // 法律提示
            legalTips: [],
            riskSummary: {
                high: 0,
                medium: 0,
                low: 0
            },
            activeRiskPoint: null,
            
            // 法律知识库状态
            legalClauses: [],
            categories: [],
            sources: [],
            currentPage: 1,
            pageSize: 20,
            totalClauses: 0,
            knowledgeSearch: '',
            selectedCategory: '',
            selectedSource: '',
            selectedClause: null,
            showClauseDetail: false,
            knowledgeLoading: false,
            
            // Quill 编辑器实例
            editor: null,
            reviewEditor: null,
            
            // 用户选择相关
            selectedUserIds: [],
            
            // 页面状态
            activeView: 'login', // login, chat, contracts, generate, review, knowledge, stats, ai_chat, profile, contract_check, contract_view
            loading: false,
            deleteLoading: false,
            error: null,
            
            // 个人中心相关
            profileForm: {
                name: '',
                email: '',
                user_type: '',
                avatar: ''
            },
            passwordForm: {
                old_password: '',
                new_password: '',
                confirm_password: ''
            },
            profileLoading: false,
            passwordLoading: false,
            profileSuccess: false,
            passwordSuccess: false
        };
    },
    mounted() {
        // 检查本地存储中的 token
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        console.log('页面加载时，从 localStorage 获取 token:', token);
        console.log('页面加载时，从 localStorage 获取 user:', user);
        if (token && user) {
            this.isLoggedIn = true;
            this.user = JSON.parse(user);
            this.activeView = 'chat';
            this.loadChatRooms();
            this.loadAvailableRooms(); // 加载可加入的聊天室列表
            this.initProfileForm(); // 初始化个人资料表单
        }
        
        // 初始化验证码
        this.refreshCaptcha();
    },
    updated() {
        // 确保在视图更新后初始化编辑器
        this.$nextTick(() => {
            if (this.activeView === 'generate' && !this.editor) {
                this.initEditor();
            }
            if (this.activeView === 'review' && !this.reviewEditor) {
                this.initReviewEditor();
            }
        });
    },
    methods: {
        // 获取验证码
        // 打开滑块验证码弹窗
        openSliderCaptcha() {
            this.sliderCaptcha.is_open = true;
            this.refreshCaptcha();
        },
        
        // 关闭滑块验证码弹窗
        closeSliderCaptcha() {
            this.sliderCaptcha.is_open = false;
            this.sliderVerified = false;
            this.sliderX = 0;
            this.sliderY = 0;
            this.sliderStatus = 'default';
            this.sliderMessage = '按住左边按钮拖动完成上方拼图';
        },
        
        // 刷新滑块验证码（前端模拟）
        refreshCaptcha() {
            try {
                this.sliderVerified = false;
                this.sliderX = 0;
                this.sliderY = 0;
                this.sliderStatus = 'default';
                this.sliderMessage = '按住左边按钮拖动完成上方拼图';
                
                console.log('开始生成滑块验证码...');
                
                // 生成随机背景图（使用随机图片API）
                const backgroundUrl = `https://picsum.photos/320/150?random=${Math.random()}`;
                
                // 生成随机缺口位置（右侧）
                const gapX = 200 + Math.floor(Math.random() * 60); // 右侧140-200范围
                const gapY = 20 + Math.floor(Math.random() * 90); // 垂直方向20-110范围
                
                // 保留is_open属性
                const isOpen = this.sliderCaptcha.is_open;
                
                // 预加载图片
                const img = new Image();
                img.onload = () => {
                    console.log('图片加载完成');
                    // 图片加载完成后再更新状态
                    this.sliderCaptcha = {
                        ...this.sliderCaptcha,
                        background: backgroundUrl,
                        slider: backgroundUrl, // 滑块使用相同的背景图
                        gap_x: gapX,
                        gap_y: gapY,
                        is_open: isOpen
                    };
                    
                    // 滑块初始位置在左边（x=0），Y 位置与缺口相同
                    this.sliderX = 0;
                    this.sliderY = gapY;
                    
                    console.log('滑块验证码生成成功:', this.sliderCaptcha);
                    console.log('缺口位置 - x:', gapX, 'y:', gapY);
                    console.log('滑块初始位置 - x:', this.sliderX, 'y:', this.sliderY);
                };
                img.onerror = () => {
                    console.error('图片加载失败，使用备用图片');
                    // 使用备用图片
                    const fallbackUrl = `https://via.placeholder.com/320x150?text=验证码`;
                    this.sliderCaptcha = {
                        ...this.sliderCaptcha,
                        background: fallbackUrl,
                        slider: fallbackUrl,
                        gap_x: gapX,
                        gap_y: gapY,
                        is_open: isOpen
                    };
                    this.sliderX = 0;
                    this.sliderY = gapY;
                };
                img.src = backgroundUrl;
            } catch (error) {
                console.error('生成滑块验证码失败:', error);
                this.$message.error('生成验证码失败，请重试');
            }
        },
        
        // 开始滑动
        startSlide(event) {
            this.isSliding = true;
            this.dragStartX = event.type === 'mousedown' ? event.clientX : event.touches[0].clientX;
            
            // 防止拖动时选中文字
            event.preventDefault();
            
            // 添加全局事件监听
            document.addEventListener('mousemove', this.slide);
            document.addEventListener('mouseup', this.stopSlide);
            document.addEventListener('touchmove', this.slide);
            document.addEventListener('touchend', this.stopSlide);
            document.addEventListener('mouseleave', this.stopSlide);
            document.addEventListener('touchcancel', this.stopSlide);
        },
        
        // 滑动中
        slide(event) {
            if (!this.isSliding) return;
            
            // 防止拖动时选中文字
            event.preventDefault();
            
            const currentX = event.type === 'mousemove' ? event.clientX : event.touches[0].clientX;
            const diffX = currentX - this.dragStartX;
            
            // 限制滑动范围
            const maxSlide = 260; // 滑块轨道的最大宽度
            if (diffX > 0 && diffX < maxSlide) {
                this.sliderX = diffX;
            } else if (diffX >= maxSlide) {
                this.sliderX = maxSlide;
            } else {
                this.sliderX = 0;
            }
        },
        
        // 停止滑动
        stopSlide() {
            if (!this.isSliding) return;
            this.isSliding = false;
            
            // 移除全局事件监听
            document.removeEventListener('mousemove', this.slide);
            document.removeEventListener('mouseup', this.stopSlide);
            document.removeEventListener('touchmove', this.slide);
            document.removeEventListener('touchend', this.stopSlide);
            document.removeEventListener('mouseleave', this.stopSlide);
            document.removeEventListener('touchcancel', this.stopSlide);
            
            // 验证滑块位置
            if (this.sliderX > 20) {
                this.verifySlider();
            } else {
                // 滑动距离不足，回弹
                this.resetSliderPosition();
            }
        },
        
        // 验证滑块（前端模拟）
        verifySlider() {
            try {
                // 计算误差
                const xDiff = Math.abs(this.sliderX - this.sliderCaptcha.gap_x);
                
                if (xDiff <= 3) { // 3像素误差容忍度
                    // 验证成功
                    this.sliderVerified = true;
                    this.sliderStatus = 'success';
                    this.sliderMessage = '验证通过';
                    
                    // 延迟1秒后关闭弹窗并登录
                    setTimeout(() => {
                        this.closeSliderCaptcha();
                        this.loginAfterCaptcha();
                    }, 1000);
                } else {
                    // 验证失败
                    this.sliderStatus = 'error';
                    this.sliderMessage = '验证失败，请重试';
                    
                    // 滑块回弹动画
                    this.resetSliderPosition();
                    
                    // 2秒后恢复默认提示
                    setTimeout(() => {
                        this.sliderStatus = 'default';
                        this.sliderMessage = '按住左边按钮拖动完成上方拼图';
                    }, 2000);
                }
            } catch (error) {
                console.error('验证滑块失败:', error);
                this.sliderStatus = 'error';
                this.sliderMessage = '验证失败，请重试';
                this.resetSliderPosition();
                
                // 2秒后恢复默认提示
                setTimeout(() => {
                    this.sliderStatus = 'default';
                    this.sliderMessage = '按住左边按钮拖动完成上方拼图';
                }, 2000);
            }
        },
        
        // 重置滑块位置（带动画）
        resetSliderPosition() {
            // 平滑回弹动画
            const duration = 300; // 300ms
            const startX = this.sliderX;
            const startTime = Date.now();
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // 使用缓动函数
                const easeOut = 1 - Math.pow(1 - progress, 3);
                this.sliderX = startX * (1 - easeOut);
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.sliderX = 0;
                }
            };
            
            animate();
        },
        
        // 登录
        async login() {
            // 先打开滑块验证码弹窗
            this.openSliderCaptcha();
        },
        
        // 验证码验证成功后的登录处理
        async loginAfterCaptcha() {
            this.loading = true;
            this.error = null;
            
            try {
                // 前端模拟登录验证
                // 这里可以根据实际需求修改登录逻辑
                if (this.loginForm.username && this.loginForm.password) {
                    // 模拟登录成功
                    const mockUser = {
                        id: 1,
                        username: this.loginForm.username,
                        name: this.loginForm.username,
                        email: `${this.loginForm.username}@example.com`,
                        user_type: 'individual'
                    };
                    
                    // 模拟token
                    const mockToken = 'mock-token-' + Date.now();
                    
                    // 保存token和用户信息
                    localStorage.setItem('token', mockToken);
                    localStorage.setItem('user', JSON.stringify(mockUser));
                    
                    // 设置登录状态
                    this.isLoggedIn = true;
                    this.user = mockUser;
                    this.activeView = 'chat';
                    
                    // 清空表单
                    this.loginForm = {
                        username: '',
                        password: ''
                    };
                    
                    // 延迟一下再加载聊天房间
                    setTimeout(() => {
                        this.loadChatRooms();
                    }, 100);
                } else {
                    throw new Error('请输入用户名和密码');
                }
            } catch (error) {
                console.error('登录失败:', error);
                this.error = error.message || '登录失败，请检查用户名和密码';
            } finally {
                this.loading = false;
            }
        },
        
        // 注册
        async register() {
            this.loading = true;
            this.error = null;
            
            try {
                const response = await axiosInstance.post('/auth/register', this.registerForm);
                
                // 注册成功后直接设置登录状态，不调用login()函数
                const user = response.data;
                
                // 手动登录，直接设置状态，不请求验证码
                const tokenResponse = await axiosInstance.post('/auth/login', {
                    username: this.registerForm.username,
                    password: this.registerForm.password,
                    captcha_id: this.sliderCaptcha.captcha_id
                });
                
                // 保存token和用户信息
                localStorage.setItem('token', tokenResponse.data.access_token);
                localStorage.setItem('user', JSON.stringify(tokenResponse.data.user));
                
                // 设置登录状态
                this.isLoggedIn = true;
                this.user = tokenResponse.data.user;
                this.activeView = 'chat';
                
                // 清空表单
                this.registerForm = {
                    username: '',
                    email: '',
                    password: '',
                    name: '',
                    user_type: 'individual'
                };
                
                // 加载聊天房间
                setTimeout(() => {
                    this.loadChatRooms();
                }, 100);
            } catch (error) {
                this.error = error.response?.data?.detail || '注册失败，请检查表单信息';
            } finally {
                this.loading = false;
            }
        },
        
        // 登出
        logout() {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            this.isLoggedIn = false;
            this.user = null;
            this.activeView = 'login';
            this.currentChatRoom = null;
            this.messages = [];
            this.contracts = [];
            this.currentContract = null;
            
            // 关闭WebSocket连接
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }
            
            // 销毁编辑器实例
            if (this.editor) {
                this.editor.destroy();
                this.editor = null;
            }
            if (this.reviewEditor) {
                this.reviewEditor.destroy();
                this.reviewEditor = null;
            }
        },
        
        // 菜单选择处理
        handleMenuSelect(key) {
            this.switchView(key);
        },
        
        // 切换视图
            switchView(view) {
                this.activeView = view;
                
                // 处理WebSocket连接
                if (view === 'ai_chat') {
                    // 当切换到AI助手界面时，关闭WebSocket连接
                    if (this.ws) {
                        this.ws.close();
                        this.ws = null;
                    }
                } else if (view === 'chat' && this.currentChatRoom) {
                    // 当切换回聊天界面时，重新连接WebSocket
                    this.connectWebSocket(this.currentChatRoom.id);
                }
                
                if (view === 'contracts') {
                    this.loadContracts();
                } else if (view === 'stats') {
                    this.loadStats();
                } else if (view === 'knowledge') {
                    // 切换到法律知识库时，获取法律条款
                    this.fetchLegalClauses();
                }
            },
            
            // 获取法律条款列表
            async fetchLegalClauses() {
                this.knowledgeLoading = true;
                try {
                    const skip = (this.currentPage - 1) * this.pageSize;
                    const params = new URLSearchParams({
                        skip: skip.toString(),
                        limit: this.pageSize.toString()
                    });
                    
                    if (this.selectedCategory) {
                        params.append('category', this.selectedCategory);
                    }
                    if (this.selectedSource) {
                        params.append('source', this.selectedSource);
                    }
                    if (this.knowledgeSearch) {
                        params.append('search', this.knowledgeSearch);
                    }
                    
                    const response = await axiosInstance.get(`/legal-knowledge/clauses?${params.toString()}`);
                    this.legalClauses = response.data;
                    
                    // 获取总数（这里简化处理，实际应该从API返回）
                    const totalResponse = await axiosInstance.get(`/legal-knowledge/clauses?${new URLSearchParams({ limit: '1' }).toString()}`);
                    this.totalClauses = response.data.length;
                    
                    // 加载分类和来源
                    this.loadCategories();
                    this.loadSources();
                } catch (error) {
                    console.error('获取法律条款失败:', error);
                    this.$message.error('获取法律条款失败，请稍后重试');
                } finally {
                    this.knowledgeLoading = false;
                }
            },
            
            // 加载分类列表
            async loadCategories() {
                try {
                    const response = await axiosInstance.get('/legal-knowledge/categories');
                    this.categories = response.data;
                } catch (error) {
                    console.error('获取分类列表失败:', error);
                }
            },
            
            // 加载来源列表
            async loadSources() {
                try {
                    const response = await axiosInstance.get('/legal-knowledge/sources');
                    this.sources = response.data;
                } catch (error) {
                    console.error('获取来源列表失败:', error);
                }
            },
            
            // 查看法律条款详情
            viewLegalClauseDetail(clause) {
                this.selectedClause = clause;
                this.showClauseDetail = true;
            },
            
            // 关闭条款详情弹窗
            closeClauseDetail() {
                this.showClauseDetail = false;
                this.selectedClause = null;
            },
            
            // 刷新法律条款
            refreshLegalClauses() {
                this.fetchLegalClauses();
            },
            
            // 处理分页大小变化
            handlePageSizeChange(size) {
                this.pageSize = size;
                this.currentPage = 1;
                this.fetchLegalClauses();
            },
            
            // 处理当前页变化
            handleCurrentPageChange(page) {
                this.currentPage = page;
                this.fetchLegalClauses();
            },
            
            // 从聊天记录生成合同
            async generateContractFromChat() {
                console.log('生成合同按钮点击');
                
                if (!this.currentChatRoom) {
                    this.$message.warning('请先选择一个聊天房间');
                    return;
                }
                
                console.log('开始生成合同，聊天房间ID:', this.currentChatRoom.id);
                console.log('当前token:', localStorage.getItem('token'));
                
                // 立即设置loading状态
                this.loading = true;
                console.log('设置loading状态为true');
                
                let contractData = null;
                
                try {
                    // 调用API从聊天记录生成合同
                    console.log('调用合同生成API:', '/chat/generate-contract');
                    const response = await axiosInstance.post('/chat/generate-contract', {
                        chat_room_id: this.currentChatRoom.id
                    }, {
                        timeout: 60000 // 增加超时时间到60秒
                    });
                    
                    console.log('合同生成API响应:', response);
                    console.log('响应数据:', response.data);
                    
                    contractData = response.data;
                } catch (error) {
                    console.error('从聊天记录生成合同失败:', error);
                    console.error('错误详情:', {
                        status: error.response?.status,
                        data: error.response?.data,
                        headers: error.response?.headers,
                        message: error.message
                    });
                    
                    // 更详细的错误提示
                    if (error.response) {
                        if (error.response.status === 401) {
                            this.$message.error('未授权，请重新登录');
                        } else if (error.response.status === 404) {
                            this.$message.error('API端点不存在');
                        } else if (error.response.data && error.response.data.detail) {
                            this.$message.error(`合同生成失败: ${error.response.data.detail}`);
                        } else {
                            this.$message.error(`合同生成失败，服务器返回: ${error.response.status}`);
                        }
                    } else if (error.request) {
                        this.$message.error('合同生成失败，没有收到服务器响应，请检查后端服务是否正常运行');
                    } else {
                        this.$message.error(`合同生成失败: ${error.message}`);
                    }
                } finally {
                    console.log('重置loading状态为false');
                    this.loading = false;
                    
                    // 等待DOM更新完成
                    await this.$nextTick();
                    console.log('Vue DOM更新完成');
                    
                    // 如果合同生成成功，切换到合同生成页面
                    if (contractData) {
                        console.log('合同生成成功，切换到合同生成页面');
                        
                        // 保存合同到当前合同
                        this.currentContract = contractData;
                        
                        // 切换到合同生成页面
                        this.activeView = 'generate';
                        this.contractForm.title = contractData.contract_name || '生成的合同';
                        this.contractForm.template_type = contractData.template_type || 'sales';
                        
                        // 强制填充合同要素（即使没有contract_elements字段）
                        console.log('强制填充合同要素');
                        // 从合同内容中提取要素
                        if (contractData.current_content) {
                            console.log('从合同内容中提取要素');
                            const content = contractData.current_content;
                            
                            // 提取甲方
                            const partyARegex = /甲方[\s\S]*?[：:][\s\S]*?[\n\r]/;
                            const partyAMatch = content.match(partyARegex);
                            if (partyAMatch) {
                                const partyA = partyAMatch[0].replace(/甲方[\s\S]*?[：:]/, '').trim().replace(/[\n\r]/, '');
                                this.contractForm.party_a = partyA;
                                console.log('提取到甲方:', partyA);
                            }
                            
                            // 提取乙方
                            const partyBRegex = /乙方[\s\S]*?[：:][\s\S]*?[\n\r]/;
                            const partyBMatch = content.match(partyBRegex);
                            if (partyBMatch) {
                                const partyB = partyBMatch[0].replace(/乙方[\s\S]*?[：:]/, '').trim().replace(/[\n\r]/, '');
                                this.contractForm.party_b = partyB;
                                console.log('提取到乙方:', partyB);
                            }
                            
                            // 提取标的
                            const subjectRegex = /[标的][\s\S]*?[：:][\s\S]*?[\n\r]/;
                            const subjectMatch = content.match(subjectRegex);
                            if (subjectMatch) {
                                const subject = subjectMatch[0].replace(/[标的][\s\S]*?[：:]/, '').trim().replace(/[\n\r]/, '');
                                this.contractForm.subject = subject;
                                console.log('提取到标的:', subject);
                            }
                            
                            // 提取金额
                            const amountRegex = /[金额][\s\S]*?[：:][\s\S]*?[\n\r]/;
                            const amountMatch = content.match(amountRegex);
                            if (amountMatch) {
                                const amount = amountMatch[0].replace(/[金额][\s\S]*?[：:]/, '').trim().replace(/[\n\r]/, '');
                                this.contractForm.amount = amount;
                                console.log('提取到金额:', amount);
                            }
                        }
                        
                        // 强制Vue更新
                        this.$forceUpdate();
                        console.log('强制Vue更新');
                        
                        // 延迟确保编辑器已初始化
                        setTimeout(() => {
                            this.$nextTick(() => {
                                if (this.editor) {
                                    console.log('更新编辑器内容:', contractData.current_content);
                                    this.editor.root.innerHTML = contractData.current_content || '';
                                    // 确保编辑器是只读的
                                    console.log('设置编辑器为只读模式');
                                    this.editor.enable(false);
                                } else {
                                    console.error('编辑器未初始化');
                                    // 重新初始化编辑器
                                    this.initEditor();
                                    // 再次尝试更新内容
                                    setTimeout(() => {
                                        this.$nextTick(() => {
                                            if (this.editor) {
                                                console.log('重新初始化后更新编辑器内容');
                                                this.editor.root.innerHTML = contractData.current_content || '';
                                                // 确保编辑器是只读的
                                                console.log('设置编辑器为只读模式');
                                                this.editor.enable(false);
                                            }
                                        });
                                    }, 500);
                                }
                            });
                        }, 1000);
                        
                        this.$message.success('合同生成成功');
                    }
                }
            },
        
        // 加载聊天房间
        async loadChatRooms() {
            try {
                // 前端模拟聊天房间数据
                // 这里可以根据实际需求修改模拟数据
                const mockChatRooms = [
                    {
                        id: 1,
                        name: '合同讨论群',
                        description: '讨论合同相关问题',
                        users: [
                            { id: 1, username: this.user.username, name: this.user.name }
                        ]
                    },
                    {
                        id: 2,
                        name: '法律咨询群',
                        description: '提供法律咨询服务',
                        users: [
                            { id: 1, username: this.user.username, name: this.user.name }
                        ]
                    }
                ];
                
                this.chatRooms = mockChatRooms;
                console.log('聊天房间加载成功:', mockChatRooms);
                this.$message.success(`成功加载${mockChatRooms.length}个聊天房间`);
            } catch (error) {
                console.error('加载聊天房间失败:', error);
                this.$message.error('加载聊天房间失败，请稍后重试');
            }
        },
        
        // 加载可加入的聊天室列表
        async loadAvailableRooms() {
            try {
                // 前端模拟可加入的聊天房间数据
                const mockAvailableRooms = [
                    {
                        id: 3,
                        name: '新合同协商群',
                        description: '协商新合同条款',
                        users: []
                    },
                    {
                        id: 4,
                        name: '法律知识分享群',
                        description: '分享法律相关知识',
                        users: []
                    }
                ];
                
                this.availableRooms = mockAvailableRooms;
                console.log('可加入的聊天室加载成功:', mockAvailableRooms);
            } catch (error) {
                console.error('加载可加入的聊天室失败:', error);
                // 静默失败，不显示错误提示
                this.availableRooms = [];
            }
        },
        
        // 加入聊天室
        async joinRoom(room) {
            try {
                const response = await axiosInstance.post(`/chat/rooms/${room.id}/join`);
                this.$message.success(`成功加入聊天室：${room.name}`);
                
                // 重新加载聊天室列表
                await this.loadChatRooms();
                
                // 重新加载可加入的聊天室列表
                await this.loadAvailableRooms();
                
                // 自动进入刚加入的聊天室
                const updatedRoom = this.chatRooms.find(r => r.id === room.id);
                if (updatedRoom) {
                    this.selectChatRoom(updatedRoom);
                }
            } catch (error) {
                console.error('加入聊天室失败:', error);
                let errorMsg = '加入聊天室失败';
                if (error.response && error.response.data && error.response.data.detail) {
                    errorMsg = `加入聊天室失败：${error.response.data.detail}`;
                }
                this.$message.error(errorMsg);
            }
        },
        
        // 选择聊天室（进入聊天室）
        selectChatRoom(room) {
            this.currentChatRoom = room;
            this.messages = [];
            this.loadMessages();
            this.connectWebSocket(room);
        },
        
        // 创建聊天房间
        createChatRoom() {
            this.$prompt('请输入聊天室名称', '创建聊天室', {
                confirmButtonText: '创建',
                cancelButtonText: '取消',
                inputPlaceholder: '聊天室名称'
            }).then(({ value }) => {
                // 调用API创建聊天室
                this.loading = true;
                axiosInstance.post('/chat/rooms', {
                    name: value,
                    description: '',
                    user_ids: []
                }).then(response => {
                    this.$message.success(`成功创建聊天室: ${value}`);
                    this.loadChatRooms(); // 重新加载聊天房间列表
                }).catch(error => {
                    console.error('创建聊天室失败:', error);
                    // 添加更详细的错误信息
                    let errorMsg = '创建聊天室失败，请稍后重试';
                    if (error.response) {
                        // 服务器返回了错误响应
                        console.error('错误状态码:', error.response.status);
                        console.error('错误响应数据:', error.response.data);
                        if (error.response.status === 401) {
                            errorMsg = '创建聊天室失败: 请先登录';
                            // 清除无效token
                            localStorage.removeItem('token');
                            localStorage.removeItem('user');
                            this.isLoggedIn = false;
                            this.user = null;
                            this.activeView = 'login';
                        } else if (error.response.data && error.response.data.detail) {
                            errorMsg = `创建聊天室失败: ${error.response.data.detail}`;
                        } else {
                            errorMsg = `创建聊天室失败，服务器返回: ${error.response.status}`;
                        }
                    } else if (error.request) {
                        // 请求已发送，但没有收到响应
                        console.error('没有收到服务器响应:', error.request);
                        errorMsg = '创建聊天室失败，没有收到服务器响应，请检查后端服务是否正常运行';
                    } else {
                        // 请求配置出错
                        console.error('请求配置错误:', error.message);
                        errorMsg = `创建聊天室失败: ${error.message}`;
                    }
                    this.$message.error(errorMsg);
                }).finally(() => {
                    this.loading = false;
                });
            }).catch(() => {
                this.$message.info('取消创建');
            });
        },
        
        // 加入聊天房间
        joinChatRoom(room) {
            this.currentChatRoom = room;
            this.loadMessages();
            this.connectWebSocket(room.id);
        },
        
        // 加载消息
        async loadMessages() {
            if (!this.currentChatRoom) return;
            
            try {
                // 前端模拟消息数据
                const mockMessages = [
                    {
                        id: 1,
                        content: '欢迎加入聊天室！',
                        sender_id: -1,
                        sender_name: '系统',
                        chat_room_id: this.currentChatRoom.id,
                        is_read: true,
                        created_at: new Date().toISOString(),
                        is_ai_message: true
                    },
                    {
                        id: 2,
                        content: '大家好！',
                        sender_id: 1,
                        sender_name: this.user.name,
                        chat_room_id: this.currentChatRoom.id,
                        is_read: true,
                        created_at: new Date().toISOString()
                    }
                ];
                
                this.messages = mockMessages;
                console.log('消息加载成功:', mockMessages);
            } catch (error) {
                console.error('加载消息失败:', error);
            }
        },
        
        // 连接WebSocket（前端模拟）
        connectWebSocket(chatRoomId) {
            console.log('模拟连接WebSocket，房间ID:', chatRoomId, '用户ID:', this.user?.id);
            
            // 关闭现有连接
            if (this.ws) {
                console.log('关闭现有WebSocket连接');
                this.ws = null;
            }
            
            if (!this.user) {
                console.error('用户未登录，无法连接WebSocket');
                return;
            }
            
            // 模拟WebSocket连接成功
            console.log('WebSocket连接已建立（模拟）');
            this.$message.success('WebSocket连接已建立');
            
            // 模拟收到系统消息
            setTimeout(() => {
                const systemMessage = {
                    id: Date.now(),
                    content: `您已加入 ${this.currentChatRoom.name}`,
                    sender_id: -1,
                    sender_name: '系统',
                    chat_room_id: chatRoomId,
                    is_read: true,
                    created_at: new Date().toISOString(),
                    is_ai_message: true
                };
                this.messages.push(systemMessage);
                
                // 滚动到底部
                this.$nextTick(() => {
                    const messagesContainer = document.querySelector('.messages-container');
                    if (messagesContainer) {
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                });
            }, 1000);
        },
        
        // 发送消息（前端模拟）
        sendMessage() {
            console.log('发送消息按钮点击，检查条件：', {
                hasMessage: this.newMessage.trim(),
                hasChatRoom: !!this.currentChatRoom
            });
            
            if (!this.newMessage.trim() || !this.currentChatRoom) {
                console.log('消息发送条件不满足');
                return;
            }
            
            // 创建本地消息对象，立即显示在聊天窗口中
            const localMessage = {
                id: Date.now(), // 使用时间戳作为临时ID
                content: this.newMessage,
                sender_id: this.user.id,
                sender_name: this.user.name || this.user.username,
                chat_room_id: this.currentChatRoom.id,
                is_read: false,
                created_at: new Date().toISOString(),
                is_local: false
            };
            
            // 将消息添加到本地数组，立即显示
            this.messages.push(localMessage);
            console.log('已添加本地消息:', localMessage);
            
            // 清空输入框
            this.newMessage = '';
            
            // 模拟收到系统回复
            setTimeout(() => {
                const systemReply = {
                    id: Date.now() + 1,
                    content: '收到您的消息，正在处理...',
                    sender_id: -1,
                    sender_name: '系统',
                    chat_room_id: this.currentChatRoom.id,
                    is_read: true,
                    created_at: new Date().toISOString(),
                    is_ai_message: true
                };
                this.messages.push(systemReply);
                
                // 滚动到底部
                this.$nextTick(() => {
                    const messagesContainer = document.querySelector('.messages-container');
                    if (messagesContainer) {
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                });
            }, 1000);
        },
        
        // 初始化编辑器
        initEditor() {
            if (this.$refs.editorRef) {
                console.log('初始化编辑器，设置为只读模式');
                this.editor = new Quill(this.$refs.editorRef, {
                    theme: 'snow',
                    modules: {
                        toolbar: false // 完全禁用工具栏
                    },
                    readOnly: true, // 设置为只读模式
                    placeholder: '合同内容将在这里生成...'
                });
                // 确保编辑器是只读的
                console.log('确保编辑器是只读的');
                this.editor.enable(false);
                // 添加CSS样式，使编辑器看起来是只读的
                this.$refs.editorRef.style.userSelect = 'none';
                this.$refs.editorRef.style.pointerEvents = 'none';
                console.log('编辑器初始化完成，已设置为只读');
            }
        },
        
        // 初始化审核编辑器
        initReviewEditor() {
            if (this.$refs.reviewEditorRef) {
                this.reviewEditor = new Quill(this.$refs.reviewEditorRef, {
                    theme: 'snow',
                    modules: {
                        toolbar: [
                            ['bold', 'italic', 'underline', 'strike'],
                            ['blockquote', 'code-block'],
                            [{ 'header': 1 }, { 'header': 2 }],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            [{ 'indent': '-1'}, { 'indent': '+1' }],
                            [{ 'align': [] }],
                            ['clean']
                        ]
                    },
                    placeholder: '请输入或上传合同内容...'
                });
            }
        },
        
        // 生成合同
        async generateContract() {
            this.loading = true;
            
            try {
                console.log('开始生成合同，使用前端生成方式');
                console.log('合同表单数据:', this.contractForm);
                
                // 确保表单数据完整
                if (!this.contractForm.title) {
                    this.contractForm.title = '生成的合同';
                }
                if (!this.contractForm.template_type) {
                    this.contractForm.template_type = 'sales';
                }
                
                console.log('修正后的合同表单数据:', this.contractForm);
                
                // 前端生成合同内容
                let contractContent = `合同标题：${this.contractForm.title}\n\n`;
                contractContent += `甲方：${this.contractForm.party_a || ''}\n`;
                contractContent += `乙方：${this.contractForm.party_b || ''}\n\n`;
                contractContent += `合同标的：${this.contractForm.subject || ''}\n`;
                contractContent += `合同金额：${this.contractForm.amount || ''}\n`;
                contractContent += `合同期限：${this.contractForm.term || ''}\n`;
                contractContent += `签订地点：${this.contractForm.location || ''}\n\n`;
                contractContent += '第一条 定义\n本合同中，除非上下文另有规定，下列术语具有如下含义：\n\n';
                contractContent += '第二条 合同标的\n甲乙双方就上述合同标的达成一致，乙方应按照本合同约定向甲方提供相应的产品或服务。\n\n';
                contractContent += `第三条 合同金额及支付方式\n1. 本合同总金额为：${this.contractForm.amount || ''}\n2. 支付方式：\n\n`;
                contractContent += `第四条 合同期限\n本合同期限为：${this.contractForm.term || ''}\n\n`;
                contractContent += '第五条 双方权利义务\n1. 甲方权利义务：\n   (1) 按照本合同约定支付合同价款；\n   (2) 按照本合同约定接收产品或服务；\n   (3) 其他约定：\n\n';
                contractContent += '2. 乙方权利义务：\n   (1) 按照本合同约定提供产品或服务；\n   (2) 保证产品或服务的质量；\n   (3) 其他约定：\n\n';
                contractContent += '第六条 违约责任\n1. 任何一方违反本合同约定，应向对方承担违约责任；\n2. 违约方应赔偿对方因此遭受的全部损失。\n\n';
                contractContent += '第七条 争议解决\n本合同履行过程中发生的争议，由双方协商解决；协商不成的，任何一方均有权向有管辖权的人民法院提起诉讼。\n\n';
                contractContent += '第八条 其他约定\n1. 本合同自双方签字盖章之日起生效；\n2. 本合同一式两份，甲乙双方各执一份，具有同等法律效力。\n\n';
                contractContent += `甲方（盖章）：${this.contractForm.party_a || ''}\n`;
                contractContent += '法定代表人或授权代表（签字）：\n\n';
                contractContent += `乙方（盖章）：${this.contractForm.party_b || ''}\n`;
                contractContent += '法定代表人或授权代表（签字）：\n';
                contractContent += `签订日期：${new Date().toLocaleDateString()}\n`;
                contractContent += `签订地点：${this.contractForm.location || ''}\n`;
                
                console.log('前端生成的合同内容:', contractContent);
                
                // 构建合同数据
                const contractData = {
                    id: 0,
                    contract_name: this.contractForm.title,
                    creator_id: 1,
                    chat_room_id: 1,
                    template_type: this.contractForm.template_type,
                    status: 'DRAFT',
                    initial_content: contractContent,
                    current_content: contractContent,
                    legal_review_result: null,
                    is_confirmed: false,
                    created_at: new Date(),
                    updated_at: null
                };
                
                // 保存合同数据
                this.currentContract = contractData;
                
                // 确保编辑器已初始化
                if (!this.editor) {
                    console.log('编辑器未初始化，尝试初始化');
                    this.initEditor();
                    // 延迟确保编辑器已初始化
                    setTimeout(() => {
                        this.$nextTick(() => {
                            if (this.editor) {
                                this.editor.root.innerHTML = contractContent;
                                // 确保编辑器是只读的
                                this.editor.enable(false);
                                this.$refs.editorRef.style.userSelect = 'none';
                                this.$refs.editorRef.style.pointerEvents = 'none';
                            }
                        });
                    }, 100);
                } else {
                    // 更新编辑器内容
                    this.editor.root.innerHTML = contractContent;
                    // 确保编辑器是只读的
                    this.editor.enable(false);
                    this.$refs.editorRef.style.userSelect = 'none';
                    this.$refs.editorRef.style.pointerEvents = 'none';
                }
                
                this.$message.success('合同生成成功');
            } catch (error) {
                console.error('生成合同失败:', error);
                this.$message.error(`合同生成失败: ${error.message}`);
            } finally {
                this.loading = false;
            }
        },
        
        // 保存合同
        async saveContract() {
            if (!this.currentContract && !this.editor) return;
            
            this.loading = true;
            
            try {
                const contractData = {
                    title: this.contractForm.title || this.currentContract?.title,
                    current_content: this.editor ? this.editor.root.innerHTML : this.currentContract?.current_content
                };
                
                let response;
                if (this.currentContract) {
                    response = await axiosInstance.put(`/contracts/${this.currentContract.id}`, contractData);
                } else {
                    response = await axiosInstance.post('/contracts', contractData);
                    this.currentContract = response.data;
                }
                
                this.currentContract = response.data;
                this.$message.success('合同已保存');
            } catch (error) {
                console.error('保存合同失败:', error);
                this.$message.error('保存合同失败，请检查网络或联系管理员');
            } finally {
                this.loading = false;
            }
        },
        
        // 开始法律审核
        async startLegalReview() {
            if (!this.reviewEditor) return;
            
            const contractContent = this.reviewEditor.root.innerHTML;
            if (!contractContent.trim()) {
                this.$message.warning('请先输入合同内容');
                return;
            }
            
            this.loading = true;
            
            try {
                const response = await axiosInstance.post('/contracts/legal-review', {
                    contract_content: contractContent
                });
                
                this.legalTips = response.data.risk_points;
                this.riskSummary = response.data.risk_summary || {
                    high: response.data.risk_points.filter(r => r.risk_level === 'high').length,
                    medium: response.data.risk_points.filter(r => r.risk_level === 'medium').length,
                    low: response.data.risk_points.filter(r => r.risk_level === 'low').length
                };
                this.$message.success('法律审核完成');
            } catch (error) {
                console.error('法律审核失败:', error);
                this.$message.error('法律审核失败，请检查网络或联系管理员');
            } finally {
                this.loading = false;
            }
        },
        
        // 文件上传处理
        handleFileChange(file) {
            this.$message.info('文件上传功能正在开发中');
        },
        
        // 获取风险等级对应的类型
        getRiskLevelType(level) {
            const typeMap = {
                'high': 'danger',
                'medium': 'warning',
                'low': 'info'
            };
            return typeMap[level] || 'info';
        },
        
        // 加载合同列表
        async loadContracts() {
            try {
                const response = await axiosInstance.get('/contracts');
                this.contracts = response.data;
            } catch (error) {
                console.error('加载合同列表失败:', error);
            }
        },
        
        // 查看合同详情
        viewContract(contract) {
            this.currentContract = contract;
            this.activeView = 'review';
            this.$nextTick(() => {
                if (this.reviewEditor) {
                    this.reviewEditor.root.innerHTML = contract.current_content;
                }
                this.loadLegalTips(contract.id);
            });
        },
        
        // 编辑合同
        editContract(contract) {
            this.currentContract = contract;
            this.activeView = 'generate';
            this.contractForm.title = contract.title;
            this.contractForm.template_type = contract.template_type;
            this.$nextTick(() => {
                if (this.editor) {
                    this.editor.root.innerHTML = contract.current_content;
                }
            });
        },
        
        // 表单字段变化时更新合同内容
        updateContractContent() {
            if (!this.currentContract) return;
            
            console.log('更新合同内容，基于表单字段');
            console.log('当前表单数据:', this.contractForm);
            
            // 确保编辑器已初始化
            if (!this.editor) {
                console.log('编辑器未初始化，尝试初始化');
                this.initEditor();
                // 延迟确保编辑器已初始化
                setTimeout(() => {
                    this.$nextTick(() => {
                        this.updateContractContent();
                    });
                }, 100);
                return;
            }
            
            // 构建更新后的合同内容
            let updatedContent = this.currentContract.current_content;
            
            // 替换合同标题
            if (this.contractForm.title) {
                updatedContent = updatedContent.replace(/合同标题[\s\S]*?[：:][\s\S]*?[\n\r]/g, `合同标题：${this.contractForm.title}\n`);
            }
            
            // 替换甲方名称
            if (this.contractForm.party_a) {
                updatedContent = updatedContent.replace(/甲方[\s\S]*?[：:][\s\S]*?[\n\r]/g, `甲方：${this.contractForm.party_a}\n`);
                updatedContent = updatedContent.replace(/甲方\([^)]+\)[\s\S]*?[：:][\s\S]*?[\n\r]/g, `甲方（${this.contractForm.party_a}）：\n`);
            }
            
            // 替换乙方名称
            if (this.contractForm.party_b) {
                updatedContent = updatedContent.replace(/乙方[\s\S]*?[：:][\s\S]*?[\n\r]/g, `乙方：${this.contractForm.party_b}\n`);
                updatedContent = updatedContent.replace(/乙方\([^)]+\)[\s\S]*?[：:][\s\S]*?[\n\r]/g, `乙方（${this.contractForm.party_b}）：\n`);
            }
            
            // 替换合同标的
            if (this.contractForm.subject) {
                updatedContent = updatedContent.replace(/合同标的[\s\S]*?[：:][\s\S]*?[\n\r]/g, `合同标的：${this.contractForm.subject}\n`);
            }
            
            // 替换合同金额
            if (this.contractForm.amount) {
                updatedContent = updatedContent.replace(/合同金额[\s\S]*?[：:][\s\S]*?[\n\r]/g, `合同金额：${this.contractForm.amount}\n`);
            }
            
            // 替换合同期限
            if (this.contractForm.term) {
                updatedContent = updatedContent.replace(/合同期限[\s\S]*?[：:][\s\S]*?[\n\r]/g, `合同期限：${this.contractForm.term}\n`);
            }
            
            // 替换签订地点
            if (this.contractForm.location) {
                updatedContent = updatedContent.replace(/签订地点[\s\S]*?[：:][\s\S]*?[\n\r]/g, `签订地点：${this.contractForm.location}\n`);
            }
            
            console.log('更新后的合同内容:', updatedContent);
            
            // 更新编辑器内容
            this.editor.root.innerHTML = updatedContent;
            
            // 确保编辑器是只读的
            console.log('确保编辑器是只读的');
            this.editor.enable(false);
            this.$refs.editorRef.style.userSelect = 'none';
            this.$refs.editorRef.style.pointerEvents = 'none';
            
            // 更新当前合同内容
            this.currentContract.current_content = updatedContent;
        },
        
        // 审核合同
        reviewContract(contract) {
            this.viewContract(contract);
        },
        
        // 加载法律提示
        async loadLegalTips(contractId) {
            try {
                const response = await axiosInstance.post('/contracts/legal-review', {
                    contract_id: contractId
                });
                
                this.legalTips = response.data.risk_points;
                this.riskSummary = response.data.risk_summary || {
                    high: response.data.risk_points.filter(r => r.risk_level === 'high').length,
                    medium: response.data.risk_points.filter(r => r.risk_level === 'medium').length,
                    low: response.data.risk_points.filter(r => r.risk_level === 'low').length
                };
            } catch (error) {
                console.error('加载法律提示失败:', error);
            }
        },
        
        // 加载资源统计
        async loadStats() {
            try {
                // 资源统计API尚未实现，暂时使用模拟数据
                // const response = await axiosInstance.get('/stats/resources');
                // 处理统计数据
                // console.log('资源统计数据:', response.data);
                this.$message.info('资源统计功能正在开发中');
            } catch (error) {
                console.error('加载资源统计失败:', error);
                this.$message.error('加载资源统计失败，该功能正在开发中');
            }
        },
        
        // 格式化时间
        formatTime(timeStr) {
            const date = new Date(timeStr);
            return date.toLocaleTimeString();
        },
        
        // 格式化日期时间
        formatDateTime(timeStr) {
            const date = new Date(timeStr);
            return date.toLocaleString();
        },
        
        // 删除聊天房间
        async deleteChatRoom(room) {
            this.$confirm(`确定要删除聊天室 "${room.name}" 吗？`, '删除确认', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(async () => {
                try {
                    this.deleteLoading = true;
                    console.log(`尝试删除聊天室: ${room.name}, ID: ${room.id}`);
                    
                    // 调用API删除聊天室
                    const response = await axiosInstance.delete(`/chat/rooms/${room.id}`);
                    
                    // 处理204 No Content响应
                    if (response.status === 204 || response.status === 200) {
                        this.$message.success(`成功删除聊天室: ${room.name}`);
                        console.log(`成功删除聊天室: ${room.name}`);
                        
                        // 重新加载聊天房间列表
                        this.loadChatRooms();
                        
                        // 如果当前在该聊天室，清空当前聊天室
                        if (this.currentChatRoom && this.currentChatRoom.id === room.id) {
                            this.currentChatRoom = null;
                            this.messages = [];
                            // 关闭WebSocket连接
                            if (this.ws) {
                                this.ws.close();
                                this.ws = null;
                            }
                        }
                    } else {
                        console.error(`删除聊天室失败，状态码: ${response.status}`);
                        this.$message.error(`删除聊天室失败，服务器返回: ${response.status}`);
                    }
                } catch (error) {
                    console.error('删除聊天室失败:', error);
                    console.error('错误详情:', {
                        status: error.response?.status,
                        data: error.response?.data,
                        headers: error.response?.headers
                    });
                    
                    let errorMsg = '删除聊天室失败，请稍后重试';
                    if (error.response) {
                        // 服务器返回了错误响应
                        if (error.response.status === 403) {
                            errorMsg = '只有聊天室创建者可以删除聊天室';
                        } else if (error.response.status === 404) {
                            errorMsg = '聊天室不存在，可能已经被删除';
                        } else if (error.response.data && error.response.data.detail) {
                            errorMsg = `删除聊天室失败: ${error.response.data.detail}`;
                        } else {
                            errorMsg = `删除聊天室失败，服务器返回: ${error.response.status}`;
                        }
                    } else if (error.request) {
                        // 请求已发送，但没有收到响应
                        errorMsg = '删除聊天室失败，没有收到服务器响应，请检查后端服务是否正常运行';
                    } else {
                        // 请求配置出错
                        errorMsg = `删除聊天室失败: ${error.message}`;
                    }
                    this.$message.error(errorMsg);
                } finally {
                    this.deleteLoading = false;
                }
            }).catch(() => {
                this.$message.info('取消删除');
            });
        },
        
        // 获取聊天室初始字母
        getRoomInitial(name) {
            if (!name) return 'C';
            return name.charAt(0).toUpperCase();
        },
        
        // 获取聊天室颜色
            getRoomColor(roomId) {
                // 使用固定的颜色列表，根据roomId取模
                const colors = [
                    '#409EFF', // 蓝色
                    '#67C23A', // 绿色
                    '#E6A23C', // 橙色
                    '#F56C6C', // 红色
                    '#909399', // 灰色
                    '#722ED1', // 紫色
                    '#13C2C2', // 青色
                    '#EB2F96'  // 粉色
                ];
                return colors[roomId % colors.length];
            },
            
            // AI助手聊天功能
            
            // 发送AI消息
            async sendAIMessage() {
                if (!this.aiChatInput.trim()) return;
                
                console.log('开始发送AI消息...');
                
                // 添加用户消息到聊天记录
                const userMessage = {
                    sender: 'user',
                    content: this.aiChatInput.trim(),
                    timestamp: new Date().toISOString()
                };
                this.aiChatMessages.push(userMessage);
                
                // 清空输入框
                const inputContent = this.aiChatInput.trim();
                this.aiChatInput = '';
                
                // 显示加载状态
                this.aiChatLoading = true;
                
                try {
                    // 检查当前登录状态和token
                    console.log('当前登录状态:', this.isLoggedIn);
                    console.log('当前user:', this.user);
                    
                    // 直接调用API获取AI回复
                    console.log('准备调用API:', '/chat/ai-direct-chat');
                    console.log('请求数据:', { message: inputContent });
                    
                    const response = await axiosInstance.post('/chat/ai-direct-chat', {
                        message: inputContent
                    });
                    
                    console.log('API调用成功，响应:', response);
                    
                    // 添加AI回复到聊天记录
                    const aiMessage = {
                        sender: 'ai',
                        content: response.data.response,
                        timestamp: new Date().toISOString()
                    };
                    this.aiChatMessages.push(aiMessage);
                } catch (error) {
                    console.error('发送AI消息失败:', error);
                    console.error('错误详情:', {
                        status: error.response?.status,
                        data: error.response?.data,
                        headers: error.response?.headers,
                        request: error.request,
                        message: error.message
                    });
                    
                    let errorMsg = '发送消息失败，请稍后重试';
                    if (error.response) {
                        // 服务器返回了错误响应
                        console.error('服务器返回错误状态码:', error.response.status);
                        console.error('服务器返回错误数据:', error.response.data);
                        
                        if (error.response.status === 401) {
                            errorMsg = '未授权，请重新登录';
                            // 清除无效token
                            localStorage.removeItem('token');
                            localStorage.removeItem('user');
                            this.isLoggedIn = false;
                            this.user = null;
                            this.activeView = 'login';
                        } else if (error.response.status === 403) {
                            errorMsg = '没有权限访问该功能';
                        } else if (error.response.status === 404) {
                            errorMsg = 'API端点不存在';
                        } else if (error.response.data && error.response.data.detail) {
                            errorMsg = `发送消息失败: ${error.response.data.detail}`;
                        } else {
                            errorMsg = `发送消息失败，服务器返回: ${error.response.status}`;
                        }
                    } else if (error.request) {
                        // 请求已发送，但没有收到响应
                        console.error('没有收到服务器响应:', error.request);
                        errorMsg = '发送消息失败，没有收到服务器响应，请检查后端服务是否正常运行';
                    } else {
                        // 请求配置出错
                        console.error('请求配置错误:', error.message);
                        errorMsg = `发送消息失败: ${error.message}`;
                    }
                    this.$message.error(errorMsg);
                } finally {
                    // 隐藏加载状态
                    this.aiChatLoading = false;
                    console.log('AI消息发送流程结束');
                }
            },
            
            // 清空AI聊天历史
            clearAIChatHistory() {
                this.$confirm('确定要清空所有对话记录吗？', '清空对话', {
                    confirmButtonText: '确定',
                    cancelButtonText: '取消',
                    type: 'warning'
                }).then(() => {
                    this.aiChatMessages = [];
                    this.$message.success('对话记录已清空');
                }).catch(() => {
                    // 用户取消清空操作
                });
            },
            
            // 个人中心相关方法
            
            // 初始化个人资料表单
            initProfileForm() {
                if (this.user) {
                    this.profileForm = {
                        name: this.user.name || '',
                        email: this.user.email || '',
                        user_type: this.user.user_type || '',
                        avatar: this.user.avatar || ''
                    };
                }
            },
            
            // 更新个人资料
            async updateProfile() {
                this.profileLoading = true;
                this.profileSuccess = false;
                
                try {
                    // 前端模拟更新个人资料
                    // 这里可以根据实际需求修改为调用API
                    setTimeout(() => {
                        // 更新本地用户信息
                        this.user = {
                            ...this.user,
                            ...this.profileForm
                        };
                        
                        // 更新本地存储
                        localStorage.setItem('user', JSON.stringify(this.user));
                        
                        this.profileSuccess = true;
                        this.$message.success('个人资料更新成功');
                        
                        // 3秒后隐藏成功提示
                        setTimeout(() => {
                            this.profileSuccess = false;
                        }, 3000);
                    }, 1000);
                } catch (error) {
                    console.error('更新个人资料失败:', error);
                    this.$message.error('更新个人资料失败，请稍后重试');
                } finally {
                    this.profileLoading = false;
                }
            },
            
            // 修改密码
            async changePassword() {
                if (this.passwordForm.new_password !== this.passwordForm.confirm_password) {
                    this.$message.error('两次输入的密码不一致');
                    return;
                }
                
                this.passwordLoading = true;
                this.passwordSuccess = false;
                
                try {
                    // 前端模拟修改密码
                    // 这里可以根据实际需求修改为调用API
                    setTimeout(() => {
                        this.passwordSuccess = true;
                        this.$message.success('密码修改成功');
                        
                        // 清空密码表单
                        this.passwordForm = {
                            old_password: '',
                            new_password: '',
                            confirm_password: ''
                        };
                        
                        // 3秒后隐藏成功提示
                        setTimeout(() => {
                            this.passwordSuccess = false;
                        }, 3000);
                    }, 1000);
                } catch (error) {
                    console.error('修改密码失败:', error);
                    this.$message.error('修改密码失败，请稍后重试');
                } finally {
                    this.passwordLoading = false;
                }
            },
            
            // 处理头像上传
            handleAvatarUpload(file) {
                // 前端模拟头像上传
                // 这里可以根据实际需求修改为调用API
                this.$message.info('头像上传功能正在开发中');
                
                // 模拟上传成功
                setTimeout(() => {
                    const mockAvatarUrl = `https://picsum.photos/200/200?random=${Math.random()}`;
                    this.profileForm.avatar = mockAvatarUrl;
                    this.$message.success('头像上传成功');
                }, 1000);
            },
            
            // 合同核对和查看相关方法
            
            // 从聊天记录生成合同后跳转到核对页面
            generateContractFromChat() {
                console.log('生成合同按钮点击');
                
                if (!this.currentChatRoom) {
                    this.$message.warning('请先选择一个聊天房间');
                    return;
                }
                
                console.log('开始生成合同，聊天房间ID:', this.currentChatRoom.id);
                console.log('当前token:', localStorage.getItem('token'));
                
                // 立即设置loading状态
                this.loading = true;
                console.log('设置loading状态为true');
                
                let contractData = null;
                
                try {
                    // 前端模拟从聊天记录生成合同
                    // 这里可以根据实际需求修改为调用API
                    setTimeout(() => {
                        // 模拟从聊天记录中提取的合同信息
                        const mockContractData = {
                            contract_name: '买卖合同',
                            template_type: 'sales',
                            party_a: '甲方公司',
                            party_b: '乙方公司',
                            subject: '商品销售',
                            amount: '100000元',
                            term: '1年',
                            location: '北京市'
                        };
                        
                        // 填充表单数据
                        this.contractForm = {
                            title: mockContractData.contract_name,
                            template_type: mockContractData.template_type,
                            party_a: mockContractData.party_a,
                            party_b: mockContractData.party_b,
                            subject: mockContractData.subject,
                            amount: mockContractData.amount,
                            term: mockContractData.term,
                            location: mockContractData.location
                        };
                        
                        // 跳转到合同核对页面
                        this.activeView = 'contract_check';
                        this.$message.success('合同信息已从聊天记录中提取，请核对');
                    }, 1000);
                } catch (error) {
                    console.error('从聊天记录生成合同失败:', error);
                    this.$message.error('从聊天记录生成合同失败，请稍后重试');
                } finally {
                    this.loading = false;
                }
            },
            
            // 确认生成合同
            async confirmGenerateContract() {
                // 验证表单
                if (!this.contractForm.title || !this.contractForm.party_a || !this.contractForm.party_b || !this.contractForm.subject) {
                    this.$message.error('请填写必填项');
                    return;
                }
                
                this.loading = true;
                
                try {
                    // 前端生成合同内容
                    let contractContent = `合同标题：${this.contractForm.title}\n\n`;
                    contractContent += `甲方：${this.contractForm.party_a || ''}\n`;
                    contractContent += `乙方：${this.contractForm.party_b || ''}\n\n`;
                    contractContent += `合同标的：${this.contractForm.subject || ''}\n`;
                    contractContent += `合同金额：${this.contractForm.amount || ''}\n`;
                    contractContent += `合同期限：${this.contractForm.term || ''}\n`;
                    contractContent += `签订地点：${this.contractForm.location || ''}\n\n`;
                    contractContent += '第一条 定义\n本合同中，除非上下文另有规定，下列术语具有如下含义：\n\n';
                    contractContent += '第二条 合同标的\n甲乙双方就上述合同标的达成一致，乙方应按照本合同约定向甲方提供相应的产品或服务。\n\n';
                    contractContent += `第三条 合同金额及支付方式\n1. 本合同总金额为：${this.contractForm.amount || ''}\n2. 支付方式：\n\n`;
                    contractContent += `第四条 合同期限\n本合同期限为：${this.contractForm.term || ''}\n\n`;
                    contractContent += '第五条 双方权利义务\n1. 甲方权利义务：\n   (1) 按照本合同约定支付合同价款；\n   (2) 按照本合同约定接收产品或服务；\n   (3) 其他约定：\n\n';
                    contractContent += '2. 乙方权利义务：\n   (1) 按照本合同约定提供产品或服务；\n   (2) 保证产品或服务的质量；\n   (3) 其他约定：\n\n';
                    contractContent += '第六条 违约责任\n1. 任何一方违反本合同约定，应向对方承担违约责任；\n2. 违约方应赔偿对方因此遭受的全部损失。\n\n';
                    contractContent += '第七条 争议解决\n本合同履行过程中发生的争议，由双方协商解决；协商不成的，任何一方均有权向有管辖权的人民法院提起诉讼。\n\n';
                    contractContent += '第八条 其他约定\n1. 本合同自双方签字盖章之日起生效；\n2. 本合同一式两份，甲乙双方各执一份，具有同等法律效力。\n\n';
                    contractContent += `甲方（盖章）：${this.contractForm.party_a || ''}\n`;
                    contractContent += '法定代表人或授权代表（签字）：\n\n';
                    contractContent += `乙方（盖章）：${this.contractForm.party_b || ''}\n`;
                    contractContent += '法定代表人或授权代表（签字）：\n';
                    contractContent += `签订日期：${new Date().toLocaleDateString()}\n`;
                    contractContent += `签订地点：${this.contractForm.location || ''}\n`;
                    
                    // 构建合同数据
                    const contractData = {
                        id: 0,
                        contract_name: this.contractForm.title,
                        creator_id: 1,
                        chat_room_id: 1,
                        template_type: this.contractForm.template_type,
                        status: 'DRAFT',
                        initial_content: contractContent,
                        current_content: contractContent,
                        legal_review_result: null,
                        is_confirmed: false,
                        created_at: new Date(),
                        updated_at: null
                    };
                    
                    // 保存合同数据
                    this.currentContract = contractData;
                    
                    // 跳转到合同终态查看页面
                    this.activeView = 'contract_view';
                    
                    // 延迟确保页面已切换，然后初始化编辑器
                    setTimeout(() => {
                        this.$nextTick(() => {
                            if (this.editor) {
                                this.editor.root.innerHTML = contractContent;
                                // 确保编辑器是只读的
                                this.editor.enable(false);
                                this.$refs.editorRef.style.userSelect = 'none';
                                this.$refs.editorRef.style.pointerEvents = 'none';
                            } else {
                                // 初始化编辑器
                                this.initEditor();
                                // 再次延迟确保编辑器已初始化
                                setTimeout(() => {
                                    this.$nextTick(() => {
                                        if (this.editor) {
                                            this.editor.root.innerHTML = contractContent;
                                            // 确保编辑器是只读的
                                            this.editor.enable(false);
                                            this.$refs.editorRef.style.userSelect = 'none';
                                            this.$refs.editorRef.style.pointerEvents = 'none';
                                        }
                                    });
                                }, 100);
                            }
                        });
                    }, 100);
                    
                    this.$message.success('合同生成成功');
                } catch (error) {
                    console.error('生成合同失败:', error);
                    this.$message.error('生成合同失败，请稍后重试');
                } finally {
                    this.loading = false;
                }
            },
            
            // 下载合同
            downloadContract() {
                if (!this.currentContract) return;
                
                try {
                    // 创建一个Blob对象
                    const blob = new Blob([this.currentContract.current_content], { type: 'text/plain;charset=utf-8' });
                    
                    // 创建下载链接
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${this.currentContract.contract_name}.txt`;
                    
                    // 触发下载
                    document.body.appendChild(link);
                    link.click();
                    
                    // 清理
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    
                    this.$message.success('合同下载成功');
                } catch (error) {
                    console.error('下载合同失败:', error);
                    this.$message.error('下载合同失败，请稍后重试');
                }
            }
    }
});

// 使用Element Plus
app.use(ElementPlus);

// 挂载应用
app.mount('#app');