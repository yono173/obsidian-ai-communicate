import { ItemView, WorkspaceLeaf, Notice, Modal, App, Setting, TFile, FuzzySuggestModal, MarkdownRenderer, Component } from 'obsidian';
import type AICompanionPlugin from '../main';
import { LearningMode, Message, CharacterConfig, Attachment, PromptTemplate } from '../types';
import { getTeacherSystemPrompt, getStudentSystemPrompt, getSummaryPrompt, getFeedbackPrompt, getMultiDiscussionPrompt } from '../services/prompts';
import { createAdapter, ChatCompletionRequest, attachmentsToContentParts } from '../services/modelAdapter';
import { CharacterManager } from '../services/characterManager';

export const VIEW_TYPE = 'ai-companion-chat-view';

// 解析后的角色发言结构
interface CharacterSpeech {
    characterName: string;
    action: string;
    content: string;
    isNarration?: boolean; // 是否是旁白
}

// 解析多人回复中的角色发言和旁白
function parseMultiCharacterResponse(response: string): CharacterSpeech[] {
    const speeches: CharacterSpeech[] = [];
    
    // 首先提取旁白（格式：*（旁白：...）* 或 *（旁白...）*）
    const narrationRegex = /\*（(旁白[：:]?[^）]*?)）\*/g;
    let narrationMatch;
    let narrationText = '';
    
    while ((narrationMatch = narrationRegex.exec(response)) !== null) {
        narrationText += narrationMatch[1].replace(/^旁白[：:]?\s*/, '') + ' ';
    }
    
    // 如果有旁白，添加到 speeches 开头
    if (narrationText.trim()) {
        speeches.push({
            characterName: '旁白',
            action: '',
            content: narrationText.trim(),
            isNarration: true
        });
    }
    
    // 匹配格式: **[角色名]** *动作/表情* 发言内容
    const regex = /\*\*\[(.*?)\]\*\*\s*\*(.*?)\*\s*([\s\S]*?)(?=\*\*\[|$)/g;
    
    let match;
    while ((match = regex.exec(response)) !== null) {
        const characterName = match[1].trim();
        const action = match[2].trim();
        let content = match[3].trim();
        
        // 清理内容末尾的空白
        content = content.replace(/\s+$/, '');
        
        if (content) {
            speeches.push({
                characterName,
                action,
                content
            });
        }
    }
    
    // 如果没有匹配到标准格式，尝试简单匹配 **角色名**
    if (speeches.length === 0 || (speeches.length === 1 && speeches[0].isNarration)) {
        const simpleRegex = /\*\*(.*?)\*\*\s*([\s\S]*?)(?=\*\*[^*]|$)/g;
        while ((match = simpleRegex.exec(response)) !== null) {
            const characterName = match[1].trim();
            let content = match[2].trim();
            
            // 过滤掉非角色名的匹配（如标题）
            if (characterName.length > 0 && characterName.length < 20 && 
                !characterName.includes(':') && !characterName.includes('#')) {
                // 移除可能的动作描写 *...*
                content = content.replace(/^\s*\*[^*]+\*\s*/, '').trim();
                content = content.replace(/\s+$/, '');
                
                if (content) {
                    speeches.push({
                        characterName,
                        action: '',
                        content
                    });
                }
            }
        }
    }
    
    // 如果还是没有匹配到角色发言，将整个回复作为一个角色发言（排除旁白部分）
    if (speeches.length === 0 || (speeches.length === 1 && speeches[0].isNarration)) {
        // 移除旁白后的内容
        const contentWithoutNarration = response.replace(narrationRegex, '').trim();
        if (contentWithoutNarration) {
            speeches.push({
                characterName: 'AI',
                action: '',
                content: contentWithoutNarration
            });
        }
    }
    
    return speeches;
}

export class ChatView extends ItemView {
    plugin: AICompanionPlugin;
    private messages: Message[] = [];
    private currentMode: LearningMode;
    private currentCharacters: CharacterConfig[] = []; // 支持多个角色
    private currentTopic: string = '';
    private isProcessing: boolean = false;
    private messagesContainer: HTMLElement | null = null;
    private inputEl: HTMLTextAreaElement | null = null;
    private modeIndicator: HTMLElement | null = null;
    private attachments: Attachment[] = []; // 当前待发送的附件
    private attachmentsPreview: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: AICompanionPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.currentMode = plugin.settings.activeMode;
        // 加载当前选中的角色
        this.loadCurrentCharacters();
    }

    private loadCurrentCharacters(): void {
        const ids = this.plugin.settings.activeCharacterIds;
        if (ids && ids.length > 0) {
            this.currentCharacters = this.plugin.characterManager.getCharactersByIds(ids);
        }
    }

    getViewType(): string {
        return VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'AI 学习伴侣';
    }

    getIcon(): string {
        return 'graduation-cap';
    }

    async onOpen(): Promise<void> {
        await this.render();
    }

    async onClose(): Promise<void> {
        if (this.messages.length > 0 && this.plugin.settings.autoSave) {
            await this.saveConversation();
        }
    }

    async render(): Promise<void> {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass('ai-companion-container');

        this.renderHeader(container);
        this.renderMessagesArea(container);
        this.renderInputArea(container);
    }

    private renderHeader(container: HTMLElement): void {
        const header = container.createDiv({ cls: 'ai-companion-header' });

        // 模式切换
        const modeSwitcher = header.createDiv({ cls: 'mode-switcher' });
        
        const discussionBtn = modeSwitcher.createEl('button', {
            cls: `mode-btn ${this.currentMode === 'discussion' ? 'active' : ''}`,
            text: '💬 多人探讨'
        });
        discussionBtn.addEventListener('click', () => this.switchMode('discussion'));

        const verifyBtn = modeSwitcher.createEl('button', {
            cls: `mode-btn ${this.currentMode === 'verify' ? 'active' : ''}`,
            text: '🎯 检验模式'
        });
        verifyBtn.addEventListener('click', () => this.switchMode('verify'));

        this.modeIndicator = header.createDiv({ cls: 'mode-indicator' });
        this.updateModeIndicator();

        // 控制按钮
        const controls = header.createDiv({ cls: 'header-controls' });
        
        controls.createEl('button', { text: '📋 新话题', cls: 'control-btn' })
            .addEventListener('click', () => this.showTopicModal());
        
        controls.createEl('button', { text: '👥 角色', cls: 'control-btn' })
            .addEventListener('click', () => this.showCharacterManager());
        
        controls.createEl('button', { text: '📖 背景', cls: 'control-btn' })
            .addEventListener('click', () => this.showStoryBackground());
        
        controls.createEl('button', { text: '💾 保存', cls: 'control-btn' })
            .addEventListener('click', () => this.saveConversation());
        
        controls.createEl('button', { text: '📁 历史', cls: 'control-btn' })
            .addEventListener('click', () => this.showHistory());
        
        controls.createEl('button', { text: '⚙️ 提示词', cls: 'control-btn' })
            .addEventListener('click', () => this.showPromptEditor());
    }

    private updateModeIndicator(): void {
        if (!this.modeIndicator) return;
        
        const charNames = this.currentCharacters.map(c => `${c.avatar || '🤖'} ${c.name}`).join(', ') || '选择角色';
        
        const modeText = this.currentMode === 'discussion' 
            ? `💬 多人探讨 - ${charNames}` 
            : `🎯 检验模式 - ${charNames}`;

        this.modeIndicator.setText(modeText);

        if (this.currentTopic) {
            this.modeIndicator.createEl('br');
            this.modeIndicator.createEl('span', { 
                text: `📝 主题: ${this.currentTopic}`,
                cls: 'topic-indicator'
            });
        }
    }

    private async switchMode(mode: LearningMode): Promise<void> {
        if (this.messages.length > 0) {
            if (this.plugin.settings.autoSave) {
                await this.saveConversation();
            }
            this.messages = [];
        }

        this.currentMode = mode;
        this.plugin.settings.activeMode = mode;
        await this.plugin.saveSettings();
        
        // 根据模式加载默认角色
        if (mode === 'discussion') {
            const teachers = this.plugin.characterManager.getTeachers();
            if (teachers.length > 0) {
                this.currentCharacters = teachers.slice(0, 3);
                this.plugin.settings.activeCharacterIds = this.currentCharacters.map(c => c.id);
            }
        } else {
            const students = this.plugin.characterManager.getStudents();
            if (students.length > 0) {
                this.currentCharacters = [students[0]];
                this.plugin.settings.activeCharacterIds = [students[0].id];
            }
        }
        
        await this.plugin.saveSettings();
        await this.render();
    }

    private renderMessagesArea(container: HTMLElement): void {
        this.messagesContainer = container.createDiv({ cls: 'messages-container' });

        if (this.messages.length === 0) {
            const welcome = this.messagesContainer.createDiv({ cls: 'welcome-message' });
            welcome.createEl('h3', { text: '👋 欢迎使用 AI 学习伴侣' });
            
            if (!this.currentTopic) {
                welcome.createEl('p', { text: '请点击"新话题"开始学习' });
            } else {
                welcome.createEl('p', { text: `当前主题: ${this.currentTopic}` });
                welcome.createEl('p', { text: '开始对话吧！' });
            }
        }

        this.messages.forEach(msg => this.renderMessage(msg));
        this.scrollToBottom();
    }

    private renderMessage(message: Message): void {
        if (!this.messagesContainer) return;
        
        const isUser = message.role === 'user';
        const isNarration = message.isNarration;
        
        // 旁白使用特殊样式
        if (isNarration) {
            const narrationEl = this.messagesContainer.createDiv({ cls: 'chat-narration' });
            const narrationContent = narrationEl.createDiv({ cls: 'chat-narration-content' });
            narrationContent.setText(`📖 ${message.content}`);
            return;
        }
        
        // 微信风格的消息容器
        const msgEl = this.messagesContainer.createDiv({
            cls: `chat-message ${isUser ? 'chat-message-user' : 'chat-message-ai'}`
        });
        
        // 头像区域
        const avatarWrapper = msgEl.createDiv({ cls: 'chat-avatar-wrapper' });
        const avatarEl = avatarWrapper.createDiv({ cls: 'chat-avatar' });
        
        if (isUser) {
            // 用户头像
            const userAvatar = this.plugin.settings.userAvatar || '👤';
            avatarEl.setText(userAvatar);
        } else if (message.characterAvatarPath) {
            // AI角色图片头像（优先使用消息中的头像路径）
            const img = avatarEl.createEl('img', { cls: 'avatar-img' });
            img.src = `data:image/jpeg;base64,${message.characterAvatarPath}`;
        } else {
            // AI角色emoji头像
            avatarEl.setText(message.characterAvatar || '🤖');
        }
        
        // 消息气泡区域
        const bubbleWrapper = msgEl.createDiv({ cls: 'chat-bubble-wrapper' });
        
        // 角色名称（仅AI消息显示）
        if (!isUser) {
            const nameEl = bubbleWrapper.createDiv({ cls: 'chat-character-name' });
            nameEl.setText(message.character || 'AI');
        }
        
        // 消息气泡
        const bubble = bubbleWrapper.createDiv({ cls: 'chat-bubble' });
        
        // 渲染附件（如果有）
        if (message.attachments && message.attachments.length > 0) {
            const attachmentsEl = bubble.createDiv({ cls: 'message-attachments' });
            for (const att of message.attachments) {
                if (att.type === 'image') {
                    const imgContainer = attachmentsEl.createDiv({ cls: 'attachment-image-container' });
                    const img = imgContainer.createEl('img', { cls: 'attachment-image' });
                    img.src = `data:${att.mimeType};base64,${att.content}`;
                    img.alt = att.name;
                } else {
                    const fileEl = attachmentsEl.createDiv({ cls: 'attachment-file' });
                    fileEl.createEl('span', { text: `📎 ${att.name}`, cls: 'attachment-name' });
                }
            }
        }
        
        // 消息内容 - 使用 Markdown 渲染
        const content = bubble.createDiv({ cls: 'chat-bubble-content' });
        MarkdownRenderer.renderMarkdown(
            message.content,
            content,
            '',
            new Component()
        );
        
        // 时间戳
        if (this.plugin.settings.showTimestamp) {
            const timeEl = bubbleWrapper.createDiv({ cls: 'chat-timestamp' });
            const time = new Date(message.timestamp).toLocaleTimeString();
            timeEl.setText(time);
        }

        this.scrollToBottom();
    }

    private renderInputArea(container: HTMLElement): void {
        const inputArea = container.createDiv({ cls: 'input-area' });

        // 附件预览区域
        this.attachmentsPreview = inputArea.createDiv({ cls: 'attachments-preview' });
        this.updateAttachmentsPreview();

        // 附件按钮行
        const attachmentBtns = inputArea.createDiv({ cls: 'attachment-buttons' });
        
        attachmentBtns.createEl('button', { text: '📄 添加文件', cls: 'attach-btn' })
            .addEventListener('click', () => this.showFilePicker());
        
        attachmentBtns.createEl('button', { text: '🖼️ 添加图片', cls: 'attach-btn' })
            .addEventListener('click', () => this.showImagePicker());

        // 输入框
        this.inputEl = inputArea.createEl('textarea', {
            cls: 'message-input',
            attr: {
                placeholder: this.currentMode === 'discussion' 
                    ? '输入你的问题或想法...' 
                    : '输入你的讲解...',
                rows: '3'
            }
        });

        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        const sendBtn = inputArea.createEl('button', {
            cls: 'send-btn',
            text: '发送'
        });
        sendBtn.addEventListener('click', () => this.sendMessage());
    }

    private updateAttachmentsPreview(): void {
        if (!this.attachmentsPreview) return;
        this.attachmentsPreview.empty();

        for (let i = 0; i < this.attachments.length; i++) {
            const att = this.attachments[i];
            const preview = this.attachmentsPreview.createDiv({ cls: 'attachment-preview-item' });
            
            if (att.type === 'image' && att.content) {
                const img = preview.createEl('img', { cls: 'preview-image' });
                img.src = `data:${att.mimeType};base64,${att.content}`;
            } else {
                preview.createEl('span', { text: `📄 ${att.name}` });
            }
            
            const removeBtn = preview.createEl('button', { text: '×', cls: 'remove-attachment' });
            removeBtn.addEventListener('click', () => {
                this.attachments.splice(i, 1);
                this.updateAttachmentsPreview();
            });
        }
    }

    private async showFilePicker(): Promise<void> {
        const files = this.app.vault.getFiles();
        const modal = new FileSuggestModal(this.app, files, async (file) => {
            await this.addFileAttachment(file);
        });
        modal.open();
    }

    private async addFileAttachment(file: TFile): Promise<void> {
        try {
            const content = await this.app.vault.read(file);
            this.attachments.push({
                type: 'file',
                name: file.name,
                path: file.path,
                content: content,
                mimeType: file.extension
            });
            this.updateAttachmentsPreview();
            new Notice(`已添加文件: ${file.name}`);
        } catch (error) {
            new Notice(`无法读取文件: ${error.message}`);
        }
    }

    private showImagePicker(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        
        input.addEventListener('change', async () => {
            const files = input.files;
            if (!files) return;
            
            for (let i = 0; i < files.length; i++) {
                await this.addImageAttachment(files[i]);
            }
        });
        
        input.click();
    }

    private async addImageAttachment(file: File): Promise<void> {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1];
                this.attachments.push({
                    type: 'image',
                    name: file.name,
                    content: base64,
                    mimeType: file.type
                });
                this.updateAttachmentsPreview();
                new Notice(`已添加图片: ${file.name}`);
                resolve();
            };
            reader.readAsDataURL(file);
        });
    }

    private async showTopicModal(): Promise<void> {
        const modal = new TopicModal(
            this.app,
            this.currentMode,
            this.currentCharacters,
            this.plugin.characterManager,
            async (topic, characters) => {
                this.currentTopic = topic;
                this.currentCharacters = characters;
                this.plugin.settings.activeCharacterIds = characters.map(c => c.id);
                this.messages = [];
                await this.render();
                await this.sendOpeningMessage();
            }
        );
        modal.open();
    }

    private async sendOpeningMessage(): Promise<void> {
        if (!this.currentTopic || this.currentCharacters.length === 0) {
            new Notice('请先设置学习主题和角色');
            return;
        }

        const systemPrompt = this.currentMode === 'discussion'
            ? getMultiDiscussionPrompt(
                this.currentCharacters, 
                this.currentTopic,
                this.plugin.settings.storyBackground
            )
            : getStudentSystemPrompt(this.currentCharacters[0], this.currentTopic);

        const openingMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: `让我们开始学习"${this.currentTopic}"吧！`,
            timestamp: Date.now()
        };

        await this.getAIResponse(systemPrompt, openingMessage);
    }

    private async sendMessage(): Promise<void> {
        if (!this.inputEl) return;
        
        const content = this.inputEl.value.trim();
        if (!content || this.isProcessing) return;

        if (!this.currentTopic || this.currentCharacters.length === 0) {
            new Notice('请先点击"新话题"设置学习主题');
            return;
        }

        // 创建消息，包含附件
        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: content,
            timestamp: Date.now(),
            attachments: this.attachments.length > 0 ? [...this.attachments] : undefined
        };
        
        this.messages.push(userMessage);
        this.renderMessage(userMessage);

        // 清空输入和附件
        this.inputEl.value = '';
        this.attachments = [];
        this.updateAttachmentsPreview();

        const systemPrompt = this.currentMode === 'discussion'
            ? getMultiDiscussionPrompt(
                this.currentCharacters, 
                this.currentTopic,
                this.plugin.settings.storyBackground
            )
            : getStudentSystemPrompt(this.currentCharacters[0], this.currentTopic);

        await this.getAIResponse(systemPrompt, userMessage);
    }

    private async getAIResponse(systemPrompt: string, lastMessage: Message): Promise<void> {
        this.isProcessing = true;
        this.showLoading();

        try {
            const model = this.plugin.settings.models.find(
                m => m.id === this.plugin.settings.activeModelId
            );
            if (!model) throw new Error('未配置模型');

            const adapter = createAdapter(model);
            
            // 构建消息，支持附件
            const requestMessages: ChatCompletionRequest['messages'] = [
                { role: 'system', content: systemPrompt }
            ];
            
            for (const msg of this.messages) {
                if (msg.attachments && msg.attachments.length > 0) {
                    // 有附件的消息使用多模态格式
                    requestMessages.push({
                        role: msg.role,
                        content: attachmentsToContentParts(msg.content, msg.attachments)
                    });
                } else {
                    requestMessages.push({
                        role: msg.role,
                        content: msg.content
                    });
                }
            }

            const request: ChatCompletionRequest = { messages: requestMessages };
            const response = await adapter.chat(request);

            // 在多人模式下，解析AI回复中的多个角色发言
            if (this.currentMode === 'discussion' && this.currentCharacters.length > 1) {
                const speeches = parseMultiCharacterResponse(response.content);
                
                for (const speech of speeches) {
                    // 如果是旁白，使用特殊处理
                    if (speech.isNarration) {
                        const narrationMessage: Message = {
                            id: `${Date.now()}-narration`,
                            role: 'assistant',
                            content: speech.content,
                            timestamp: Date.now(),
                            character: '旁白',
                            isNarration: true
                        };
                        this.messages.push(narrationMessage);
                        this.renderMessage(narrationMessage);
                        continue;
                    }
                    
                    // 查找对应角色的信息
                    const character = this.currentCharacters.find(c => 
                        c.name === speech.characterName || 
                        c.name.includes(speech.characterName) ||
                        speech.characterName.includes(c.name)
                    );
                    
                    console.log(`[AI Companion] 解析角色发言：${speech.characterName}, 找到角色：${character?.name}, avatarPath: ${character?.avatarPath}`);
                    
                    // 如果有动作描写，添加到内容前面
                    let displayContent = speech.content;
                    if (speech.action) {
                        displayContent = `*${speech.action}*\n\n${speech.content}`;
                    }
                    
                    const aiMessage: Message = {
                        id: `${Date.now()}-${speeches.indexOf(speech)}`,
                        role: 'assistant',
                        content: displayContent,
                        timestamp: Date.now(),
                        character: speech.characterName,
                        characterAvatar: character?.avatar || '🤖',
                        characterAvatarPath: character?.avatarPath
                    };
                    this.messages.push(aiMessage);
                    this.renderMessage(aiMessage);
                }
            } else {
                // 单人模式，直接显示
                const aiMessage: Message = {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: response.content,
                    timestamp: Date.now(),
                    character: this.currentCharacters[0]?.name || 'AI',
                    characterAvatar: this.currentCharacters[0]?.avatar || '🤖',
                    characterAvatarPath: this.currentCharacters[0]?.avatarPath
                };
                this.messages.push(aiMessage);
                this.renderMessage(aiMessage);
            }

        } catch (error: any) {
            console.error('AI response error:', error);
            new Notice(`AI 响应错误: ${error.message}`);
        } finally {
            this.isProcessing = false;
            this.hideLoading();
        }
    }

    private showLoading(): void {
        if (!this.messagesContainer) return;
        const loading = this.messagesContainer.createDiv({ cls: 'loading-indicator' });
        loading.setText('思考中...');
    }

    private hideLoading(): void {
        const loading = this.messagesContainer?.querySelector('.loading-indicator');
        if (loading) loading.remove();
    }

    private scrollToBottom(): void {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }

    async generateSummary(): Promise<void> {
        if (this.messages.length === 0) {
            new Notice('没有对话内容');
            return;
        }

        this.isProcessing = true;
        this.showLoading();

        try {
            const model = this.plugin.settings.models.find(
                m => m.id === this.plugin.settings.activeModelId
            );
            if (!model) throw new Error('未配置模型');

            const adapter = createAdapter(model);
            const prompt = this.currentMode === 'discussion'
                ? getSummaryPrompt(this.messages)
                : getFeedbackPrompt(this.messages, this.currentTopic);

            const response = await adapter.chat({
                messages: [{ role: 'user', content: prompt }]
            });

            const summaryModal = new SummaryModal(this.app, response.content, this.currentMode);
            summaryModal.open();

        } catch (error: any) {
            new Notice(`生成总结失败: ${error.message}`);
        } finally {
            this.isProcessing = false;
            this.hideLoading();
        }
    }

    async saveConversation(): Promise<void> {
        if (this.messages.length === 0) return;

        const folderPath = this.plugin.settings.conversationsFolder || 'AI-Conversations';
        
        // 创建文件夹
        if (!await this.app.vault.adapter.exists(folderPath)) {
            await this.app.vault.adapter.mkdir(folderPath);
        }

        // 生成文件名（包含主题和时间）
        const safeTopic = this.currentTopic.replace(/[\\/:*?"<>|]/g, '_').slice(0, 30);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const fileName = `${safeTopic}-${timestamp}.md`;

        // 将消息数据序列化为 JSON（用于恢复对话）
        const messagesJson = JSON.stringify(this.messages);

        // 生成 Markdown 内容（Obsidian 友好格式）
        const charNames = this.currentCharacters.map(c => c.name).join(', ');
        const charIds = this.currentCharacters.map(c => c.id).join(',');
        
        let content = `---\n`;
        content += `title: "${this.currentTopic}"\n`;
        content += `date: ${new Date().toISOString()}\n`;
        content += `mode: ${this.currentMode === 'discussion' ? '多人探讨' : '检验模式'}\n`;
        content += `modeType: ${this.currentMode}\n`;
        content += `characters: "${charNames}"\n`;
        content += `characterIds: "${charIds}"\n`;
        content += `tags: [ai-conversation, ${this.currentMode}]\n`;
        // 将消息数据保存为 JSON 字符串（用于恢复对话）
        content += `messagesData: |\n`;
        const jsonLines = messagesJson.split('\n');
        for (const line of jsonLines) {
            content += `  ${line}\n`;
        }
        content += `---\n\n`;
        
        const userAvatar = this.plugin.settings.userAvatar || '👤';
        
        content += `# ${this.currentTopic}\n\n`;
        content += `> **模式**: ${this.currentMode === 'discussion' ? '💬 多人探讨' : '🎯 检验模式'} | `;
        content += `**角色**: ${charNames} | `;
        content += `**时间**: ${new Date().toLocaleString()}\n\n`;
        content += `---\n\n`;

        // 对话记录
        for (const msg of this.messages) {
            const msgAvatar = msg.role === 'user' ? userAvatar : (msg.characterAvatar || '🤖');
            const role = msg.role === 'user' ? `${msgAvatar} 我` : `${msgAvatar} ${msg.character || 'AI'}`;
            const time = new Date(msg.timestamp).toLocaleTimeString();
            
            content += `### ${role} <small>${time}</small>\n\n`;
            
            // 附件
            if (msg.attachments && msg.attachments.length > 0) {
                content += `**附件:**\n`;
                for (const att of msg.attachments) {
                    if (att.type === 'image') {
                        // 图片嵌入 - 保存到附件文件夹
                        const imageFolder = `${folderPath}/attachments`;
                        if (!await this.app.vault.adapter.exists(imageFolder)) {
                            await this.app.vault.adapter.mkdir(imageFolder);
                        }
                        const imageName = `${Date.now()}-${att.name}`;
                        const imagePath = `${imageFolder}/${imageName}`;
                        
                        // 解码 base64 保存
                        const binaryString = atob(att.content || '');
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        await this.app.vault.adapter.writeBinary(imagePath, bytes.buffer);
                        
                        // 相对路径引用
                        const relativePath = `attachments/${imageName}`;
                        content += `![${att.name}](${relativePath})\n`;
                    } else {
                        content += `📎 \`${att.name}\`\n`;
                        if (att.content) {
                            content += `\`\`\`${att.mimeType || ''}\n${att.content.slice(0, 1000)}${att.content.length > 1000 ? '\n... (已截断)' : ''}\n\`\`\`\n`;
                        }
                    }
                }
                content += `\n`;
            }
            
            // 消息内容
            content += `${msg.content}\n\n`;
        }

        // 保存文件
        const filePath = `${folderPath}/${fileName}`;
        await this.app.vault.adapter.write(filePath, content);
        
        new Notice(`对话已保存到 ${filePath}`);
        
        // 打开保存的文件
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
            await this.app.workspace.openLinkText(filePath, '', true);
        }
    }

    private async showHistory(): Promise<void> {
        const folderPath = this.plugin.settings.conversationsFolder || 'AI-Conversations';
        
        if (!await this.app.vault.adapter.exists(folderPath)) {
            new Notice('还没有保存的对话记录');
            return;
        }

        const files = this.app.vault.getMarkdownFiles()
            .filter(f => f.path.startsWith(folderPath))
            .sort((a, b) => b.stat.mtime - a.stat.mtime);

        if (files.length === 0) {
            new Notice('还没有保存的对话记录');
            return;
        }

        const modal = new HistoryModal(
            this.app, 
            files, 
            async (file, action) => {
                if (action === 'view') {
                    await this.app.workspace.openLinkText(file.path, '', true);
                } else if (action === 'continue') {
                    await this.loadConversation(file);
                }
            }
        );
        modal.open();
    }

    private async loadConversation(file: TFile): Promise<void> {
        try {
            const content = await this.app.vault.read(file);
            
            // 解析 YAML frontmatter
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (!frontmatterMatch) {
                new Notice('无法解析对话文件');
                return;
            }

            const frontmatterText = frontmatterMatch[1];
            const frontmatter: Record<string, any> = {};
            
            // 简单解析 YAML
            const lines = frontmatterText.split('\n');
            let currentKey = '';
            let currentValue = '';
            let inMultiline = false;
            let multilineValue = '';
            
            for (const line of lines) {
                const keyMatch = line.match(/^(\w+):\s*(.*)$/);
                if (keyMatch && !line.startsWith('  ')) {
                    if (inMultiline && currentKey) {
                        frontmatter[currentKey] = multilineValue.trim();
                        inMultiline = false;
                        multilineValue = '';
                    }
                    currentKey = keyMatch[1];
                    currentValue = keyMatch[2].replace(/^"(.*)"$/, '$1');
                    
                    if (currentValue === '|') {
                        inMultiline = true;
                        continue;
                    }
                    frontmatter[currentKey] = currentValue;
                } else if (inMultiline && line.startsWith('  ')) {
                    multilineValue += line.slice(2) + '\n';
                }
            }
            
            if (inMultiline && currentKey) {
                frontmatter[currentKey] = multilineValue.trim();
            }

            // 恢复对话数据
            const topic = frontmatter.title || '未命名对话';
            const modeType = (frontmatter.modeType as LearningMode) || 'discussion';
            const characterIdsStr = frontmatter.characterIds || '';
            const messagesData = frontmatter.messagesData;

            // 恢复角色
            const characterIds = characterIdsStr.split(',').filter((id: string) => id);
            let characters: CharacterConfig[] = [];
            
            if (characterIds.length > 0) {
                characters = this.plugin.characterManager.getCharactersByIds(characterIds);
            }
            
            // 如果没有找到角色，加载默认
            if (characters.length === 0) {
                if (modeType === 'discussion') {
                    characters = this.plugin.characterManager.getTeachers().slice(0, 3);
                } else {
                    const students = this.plugin.characterManager.getStudents();
                    if (students.length > 0) characters = [students[0]];
                }
            }

            // 恢复消息
            let messages: Message[] = [];
            if (messagesData) {
                try {
                    messages = JSON.parse(messagesData);
                } catch (e) {
                    console.error('解析消息数据失败:', e);
                }
            }

            // 设置当前会话
            this.currentTopic = topic;
            this.currentMode = modeType;
            this.currentCharacters = characters;
            this.messages = messages;
            this.plugin.settings.activeMode = modeType;
            this.plugin.settings.activeCharacterIds = characters.map(c => c.id);
            
            await this.render();
            
            new Notice(`已加载对话: ${topic}`);
            
        } catch (error: any) {
            console.error('加载对话失败:', error);
            new Notice(`加载对话失败: ${error.message}`);
        }
    }

    private showCharacterManager(): void {
        const modal = new CharacterManagerModal(
            this.app,
            this.plugin.characterManager,
            this.currentCharacters,
            async (characters) => {
                this.currentCharacters = characters;
                this.plugin.settings.activeCharacterIds = characters.map(c => c.id);
                await this.plugin.saveSettings();
                this.updateModeIndicator();
            },
            async () => {
                console.log('[AI Companion] onRefresh 回调被调用');
                console.log('[AI Companion] characterManager.getCustomCharacters():', this.plugin.characterManager.getCustomCharacters());
                // 先保存设置（这会把新创建的角色保存到 settings.customCharacters）
                await this.plugin.saveSettings();
                console.log('[AI Companion] 设置已保存，customCharacters:', this.plugin.settings.customCharacters);
                // 然后重新加载角色并刷新界面
                this.loadCurrentCharacters();
                await this.render();
            }
        );
        modal.open();
    }

    private showStoryBackground(): void {
        const modal = new StoryBackgroundModal(
            this.app,
            this.plugin,
            async () => {
                await this.plugin.saveSettings();
            }
        );
        modal.open();
    }

    private showCharacterEditor(): void {
        const modal = new CharacterEditorModal(
            this.app,
            this.plugin.characterManager,
            this.currentCharacters,
            async (characters) => {
                this.currentCharacters = characters;
                this.plugin.settings.activeCharacterIds = characters.map(c => c.id);
                await this.plugin.saveSettings();
                this.updateModeIndicator();
            }
        );
        modal.open();
    }

    private showPromptEditor(): void {
        const modal = new PromptEditorModal(
            this.app,
            this.plugin.settings.customPrompts,
            this.currentMode,
            async (prompts) => {
                this.plugin.settings.customPrompts = prompts;
                await this.plugin.saveSettings();
            }
        );
        modal.open();
    }
}

// 文件选择器
class FileSuggestModal extends FuzzySuggestModal<TFile> {
    private files: TFile[];
    private onChoose: (file: TFile) => void;

    constructor(app: App, files: TFile[], onChoose: (file: TFile) => void) {
        super(app);
        this.files = files;
        this.onChoose = onChoose;
    }

    getItems(): TFile[] {
        return this.files;
    }

    getItemText(file: TFile): string {
        return file.path;
    }

    onChooseItem(file: TFile, evt: MouseEvent | KeyboardEvent): void {
        this.onChoose(file);
    }
}

// 历史记录模态框
type HistoryAction = 'view' | 'continue';

class HistoryModal extends Modal {
    private files: TFile[];
    private onSelect: (file: TFile, action: HistoryAction) => void;

    constructor(app: App, files: TFile[], onSelect: (file: TFile, action: HistoryAction) => void) {
        super(app);
        this.files = files;
        this.onSelect = onSelect;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '📁 对话历史' });

        const list = contentEl.createDiv({ cls: 'history-list' });
        
        for (const file of this.files.slice(0, 20)) { // 最多显示20条
            const item = list.createDiv({ cls: 'history-item' });
            
            const name = file.basename;
            const time = new Date(file.stat.mtime).toLocaleString();
            
            // 信息区域
            const infoEl = item.createDiv({ cls: 'history-info' });
            infoEl.createEl('div', { text: name, cls: 'history-name' });
            infoEl.createEl('div', { text: time, cls: 'history-time' });
            
            // 按钮区域
            const btnsEl = item.createDiv({ cls: 'history-actions' });
            
            btnsEl.createEl('button', { text: '👁️ 查看', cls: 'history-btn view-btn' })
                .addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.onSelect(file, 'view');
                    this.close();
                });
            
            btnsEl.createEl('button', { text: '💬 继续', cls: 'history-btn continue-btn' })
                .addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.onSelect(file, 'continue');
                    this.close();
                });
        }
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 话题选择模态框
class TopicModal extends Modal {
    private mode: LearningMode;
    private currentCharacters: CharacterConfig[];
    private characterManager: CharacterManager;
    private onSubmit: (topic: string, characters: CharacterConfig[]) => void;
    
    private topic: string = '';
    private selectedCharacterIds: Set<string> = new Set();

    constructor(
        app: App,
        mode: LearningMode,
        currentCharacters: CharacterConfig[],
        characterManager: CharacterManager,
        onSubmit: (topic: string, characters: CharacterConfig[]) => void
    ) {
        super(app);
        this.mode = mode;
        this.currentCharacters = currentCharacters;
        this.characterManager = characterManager;
        this.onSubmit = onSubmit;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: this.mode === 'discussion' ? '💬 多人探讨' : '🎯 检验理解' });

        new Setting(contentEl)
            .setName('讨论主题')
            .setDesc('输入你想探讨/检验的知识点')
            .addText(text => {
                text.setPlaceholder('例如: 柯西收敛准则、Transformer 架构...')
                    .onChange(value => {
                        this.topic = value;
                    });
                text.inputEl.style.width = '100%';
            });

        const characters = this.mode === 'discussion' 
            ? this.characterManager.getTeachers()
            : this.characterManager.getStudents();
        
        // 默认选中已有角色
        if (this.currentCharacters.length > 0) {
            this.currentCharacters.forEach(c => this.selectedCharacterIds.add(c.id));
        } else if (characters.length > 0) {
            // 默认选中第一个（检验模式）或前三个（多人探讨）
            if (this.mode === 'discussion') {
                characters.slice(0, 3).forEach(c => this.selectedCharacterIds.add(c.id));
            } else {
                this.selectedCharacterIds.add(characters[0].id);
            }
        }

        // 角色选择 - 支持多选
        const characterSection = contentEl.createDiv({ cls: 'character-selection' });
        const titleText = this.mode === 'discussion' ? '选择讨论伙伴（可多选）' : '选择检验者';
        characterSection.createEl('h3', { text: titleText });
        
        const characterGrid = characterSection.createDiv({ cls: 'character-grid' });
        
        characters.forEach((c: CharacterConfig) => {
            const levelText = c.level ? ` (${c.level === 'beginner' ? '初学者' : c.level === 'intermediate' ? '中等' : '进阶'})` : '';
            
            const charCard = characterGrid.createDiv({ 
                cls: `character-card ${this.selectedCharacterIds.has(c.id) ? 'selected' : ''}`
            });
            
            // 头像显示
            const avatarEl = charCard.createEl('div', { cls: 'character-avatar' });
            if (c.avatarPath) {
                const img = avatarEl.createEl('img', { cls: 'avatar-img' });
                img.src = `data:image/jpeg;base64,${c.avatarPath}`;
            } else {
                avatarEl.setText(c.avatar || '🤖');
            }
            
            charCard.createEl('div', { text: c.name + levelText, cls: 'character-name' });
            charCard.createEl('div', { text: c.personality.slice(0, 30) + '...', cls: 'character-hint' });
            
            charCard.addEventListener('click', () => {
                if (this.mode === 'discussion') {
                    // 多选模式
                    if (this.selectedCharacterIds.has(c.id)) {
                        this.selectedCharacterIds.delete(c.id);
                        charCard.removeClass('selected');
                    } else {
                        this.selectedCharacterIds.add(c.id);
                        charCard.addClass('selected');
                    }
                } else {
                    // 单选模式
                    characterGrid.querySelectorAll('.character-card').forEach(el => el.removeClass('selected'));
                    charCard.addClass('selected');
                    this.selectedCharacterIds.clear();
                    this.selectedCharacterIds.add(c.id);
                }
            });
        });

        new Setting(contentEl)
            .addButton(btn => {
                btn.setButtonText('取消')
                    .onClick(() => this.close());
            })
            .addButton(btn => {
                btn.setButtonText('开始')
                    .setCta()
                    .onClick(() => {
                        if (!this.topic.trim()) {
                            new Notice('请输入讨论主题');
                            return;
                        }
                        if (this.selectedCharacterIds.size === 0) {
                            new Notice('请选择至少一个角色');
                            return;
                        }
                        const selectedCharacters = characters.filter((c: CharacterConfig) => 
                            this.selectedCharacterIds.has(c.id)
                        );
                        this.onSubmit(this.topic, selectedCharacters);
                        this.close();
                    });
            });
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 总结显示模态框
class SummaryModal extends Modal {
    private content: string;
    private mode: LearningMode;

    constructor(app: App, content: string, mode: LearningMode) {
        super(app);
        this.content = content;
        this.mode = mode;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { 
            text: this.mode === 'discussion' ? '📊 学习总结' : '📝 理解度评估' 
        });

        const contentDiv = contentEl.createDiv({ cls: 'summary-content' });
        contentDiv.createEl('pre', { text: this.content });

        new Setting(contentEl)
            .addButton(btn => {
                btn.setButtonText('关闭')
                    .onClick(() => this.close());
            })
            .addButton(btn => {
                btn.setButtonText('保存到笔记')
                    .setCta()
                    .onClick(async () => {
                        await this.saveToNote();
                        this.close();
                    });
            });
    }

    async saveToNote(): Promise<void> {
        const fileName = `summary-${new Date().toISOString().slice(0, 10)}.md`;
        const folderPath = 'AI-Learning-Summaries';

        if (!await this.app.vault.adapter.exists(folderPath)) {
            await this.app.vault.adapter.mkdir(folderPath);
        }

        const filePath = `${folderPath}/${fileName}`;
        await this.app.vault.adapter.write(filePath, this.content);
        new Notice(`总结已保存到 ${filePath}`);
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 提示词编辑器模态框
class PromptEditorModal extends Modal {
    private prompts: PromptTemplate[];
    private currentMode: LearningMode;
    private onSave: (prompts: PromptTemplate[]) => void;
    private selectedPromptId: string = '';

    constructor(
        app: App,
        prompts: PromptTemplate[],
        currentMode: LearningMode,
        onSave: (prompts: PromptTemplate[]) => void
    ) {
        super(app);
        this.prompts = [...prompts];
        this.currentMode = currentMode;
        this.onSave = onSave;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('prompt-editor-modal');

        contentEl.createEl('h2', { text: '⚙️ 提示词设置' });

        // 提示词选择 - 根据当前模式过滤
        const filteredPrompts = this.prompts.filter(p => {
            if (this.currentMode === 'discussion') {
                return p.type === 'multi' || p.type === 'custom';
            } else {
                return p.type === 'student' || p.type === 'custom';
            }
        });
        
        if (filteredPrompts.length > 0) {
            this.selectedPromptId = filteredPrompts[0].id;
        }

        const promptList = contentEl.createDiv({ cls: 'prompt-list' });
        
        filteredPrompts.forEach(prompt => {
            const item = promptList.createDiv({ 
                cls: `prompt-item ${prompt.id === this.selectedPromptId ? 'active' : ''}`
            });
            
            item.createEl('div', { text: prompt.name, cls: 'prompt-name' });
            item.createEl('div', { text: prompt.description, cls: 'prompt-desc' });
            
            item.addEventListener('click', () => {
                promptList.querySelectorAll('.prompt-item').forEach(el => el.removeClass('active'));
                item.addClass('active');
                this.selectedPromptId = prompt.id;
                this.showPromptEditor(prompt);
            });
        });

        // 编辑区域
        const editorArea = contentEl.createDiv({ cls: 'prompt-editor-area' });
        
        // 变量说明
        const varInfo = editorArea.createDiv({ cls: 'variable-info' });
        varInfo.createEl('h4', { text: '可用变量' });
        const varList = varInfo.createEl('ul');
        
        if (this.currentMode === 'discussion') {
            varList.innerHTML = `
                <li><code>{{characters}}</code> - 所有角色信息</li>
                <li><code>{{topic}}</code> - 讨论主题</li>
                <li><code>{{storyBackground}}</code> - 故事背景</li>
                <li><code>{{learnerProfile}}</code> - 学习者身份</li>
                <li><code>{{teamGoal}}</code> - 团队目标</li>
                <li><code>{{material}}</code> - 参考材料</li>
            `;
        } else {
            varList.innerHTML = `
                <li><code>{{characterName}}</code> - 角色名称</li>
                <li><code>{{characterBackground}}</code> - 角色背景</li>
                <li><code>{{characterPersonality}}</code> - 性格特点</li>
                <li><code>{{characterSpeakingStyle}}</code> - 说话风格</li>
                <li><code>{{characterLevelText}}</code> - 水平描述</li>
                <li><code>{{characterLevelInstructions}}</code> - 水平对应的提问指南</li>
                <li><code>{{topic}}</code> - 学习主题</li>
            `;
        }

        // 显示第一个提示词的编辑器
        if (filteredPrompts.length > 0) {
            this.showPromptEditor(filteredPrompts[0]);
        }

        // 按钮
        new Setting(contentEl)
            .addButton(btn => {
                btn.setButtonText('恢复默认')
                    .onClick(async () => {
                        const { getDefaultPromptTemplates } = await import('../services/prompts');
                        this.prompts = getDefaultPromptTemplates();
                        this.onSave(this.prompts);
                        new Notice('已恢复默认提示词');
                        this.close();
                    });
            })
            .addButton(btn => {
                btn.setButtonText('关闭')
                    .onClick(() => this.close());
            });
    }

    private showPromptEditor(prompt: PromptTemplate): void {
        const editorArea = this.contentEl.querySelector('.prompt-editor-area');
        if (!editorArea) return;

        // 移除旧的编辑器
        const oldEditor = editorArea.querySelector('.prompt-textarea-container');
        if (oldEditor) oldEditor.remove();

        const container = editorArea.createDiv({ cls: 'prompt-textarea-container' });
        
        const textarea = container.createEl('textarea', {
            cls: 'prompt-textarea',
            attr: {
                placeholder: '输入提示词模板...',
                rows: '15'
            }
        });
        textarea.value = prompt.template;
        
        textarea.addEventListener('change', () => {
            const index = this.prompts.findIndex(p => p.id === prompt.id);
            if (index !== -1) {
                this.prompts[index].template = textarea.value;
                this.onSave(this.prompts);
            }
        });
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 角色管理器模态框 - 完整的角色管理界面
class CharacterManagerModal extends Modal {
    private characterManager: CharacterManager;
    private currentCharacters: CharacterConfig[];
    private onSelect: (characters: CharacterConfig[]) => void;
    private onRefresh: () => void;
    private selectedCharacterIds: Set<string>;

    constructor(
        app: App,
        characterManager: CharacterManager,
        currentCharacters: CharacterConfig[],
        onSelect: (characters: CharacterConfig[]) => void,
        onRefresh: () => void
    ) {
        super(app);
        this.characterManager = characterManager;
        this.currentCharacters = currentCharacters;
        this.onSelect = onSelect;
        this.onRefresh = onRefresh;
        this.selectedCharacterIds = new Set(currentCharacters.map(c => c.id));
    }

    onOpen(): void {
        this.render();
    }

    private render(currentType: 'teacher' | 'student' = 'teacher'): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('character-manager-modal');

        contentEl.createEl('h2', { text: '👥 角色管理' });

        // 分页：教学角色和学生角色
        const tabs = contentEl.createDiv({ cls: 'character-tabs' });
        
        const teacherTab = tabs.createEl('button', { 
            text: '📚 教学角色', 
            cls: `tab-btn ${currentType === 'teacher' ? 'active' : ''}` 
        });
        const studentTab = tabs.createEl('button', { 
            text: '🎓 学生角色', 
            cls: `tab-btn ${currentType === 'student' ? 'active' : ''}` 
        });

        const content = contentEl.createDiv({ cls: 'character-content' });
        
        this.renderCharacterList(content, currentType);

        teacherTab.addEventListener('click', () => {
            this.render('teacher');
        });

        studentTab.addEventListener('click', () => {
            this.render('student');
        });

        // 底部按钮
        new Setting(contentEl)
            .addButton(btn => {
                btn.setButtonText('取消')
                    .onClick(() => this.close());
            })
            .addButton(btn => {
                btn.setButtonText('确认选择')
                    .setCta()
                    .onClick(() => {
                        const allCharacters = [
                            ...this.characterManager.getTeachers(),
                            ...this.characterManager.getStudents()
                        ];
                        const selectedCharacters = allCharacters.filter(c =>
                            this.selectedCharacterIds.has(c.id)
                        );
                        this.onSelect(selectedCharacters);
                        this.close();
                    });
            });
    }

    private renderCharacterList(container: HTMLElement, type: 'teacher' | 'student'): void {
        const characters = type === 'teacher' 
            ? this.characterManager.getTeachers()
            : this.characterManager.getStudents();

        const characterList = container.createDiv({ cls: 'character-list' });

        characters.forEach((c: CharacterConfig) => {
            const item = characterList.createDiv({ cls: 'character-list-item' });
            
            const isSelected = this.selectedCharacterIds.has(c.id);
            if (isSelected) item.addClass('selected');

            // 头像
            const avatarEl = item.createDiv({ cls: 'item-avatar' });
            if (c.avatarPath) {
                const img = avatarEl.createEl('img', { cls: 'avatar-img' });
                img.src = `data:image/jpeg;base64,${c.avatarPath}`;
            } else {
                avatarEl.setText(c.avatar || '🤖');
            }

            // 信息
            const info = item.createDiv({ cls: 'item-info' });
            info.createEl('div', { text: c.name, cls: 'item-name' });
            info.createEl('div', { text: c.personality.slice(0, 50) + '...', cls: 'item-hint' });

            // 操作按钮
            const actions = item.createDiv({ cls: 'item-actions' });
            
            // 选择按钮
            const selectBtn = actions.createEl('button', { 
                text: isSelected ? '✓ 已选' : '选择', 
                cls: `select-btn ${isSelected ? 'selected' : ''}`
            });
            selectBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.selectedCharacterIds.has(c.id)) {
                    this.selectedCharacterIds.delete(c.id);
                    selectBtn.setText('选择');
                    selectBtn.removeClass('selected');
                    item.removeClass('selected');
                } else {
                    this.selectedCharacterIds.add(c.id);
                    selectBtn.setText('✓ 已选');
                    selectBtn.addClass('selected');
                    item.addClass('selected');
                }
            });

            // 编辑按钮（仅自定义角色）
            if (c.isCustom) {
                actions.createEl('button', { text: '✏️', cls: 'edit-btn' })
                    .addEventListener('click', (e) => {
                        e.stopPropagation();
                        const editModal = new FullCharacterEditorModal(
                            this.app,
                            this.characterManager,
                            async () => {
                                // 保存设置并刷新当前模态框
                                await this.onRefresh();
                                this.render(type);
                            },
                            c
                        );
                        editModal.open();
                    });
            }
        });

        // 创建新角色按钮
        const createBtn = container.createEl('button', { 
            text: `➕ 创建新${type === 'teacher' ? '教学' : '学生'}角色`, 
            cls: 'create-character-btn' 
        });
        createBtn.addEventListener('click', () => {
            const createModal = new FullCharacterEditorModal(
                this.app,
                this.characterManager,
                async () => {
                    // 保存设置并刷新当前模态框
                    await this.onRefresh();
                    // 重新渲染角色列表，保持当前类型
                    this.render(type);
                },
                { type } as CharacterConfig,
                // 新增：创建成功后的回调，自动选中新角色
                (newCharacterId: string) => {
                    this.selectedCharacterIds.add(newCharacterId);
                }
            );
            createModal.open();
        });
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 角色编辑器模态框（简单选择）
class CharacterEditorModal extends Modal {
    private characterManager: CharacterManager;
    private currentCharacters: CharacterConfig[];
    private onSave: (characters: CharacterConfig[]) => void;
    private selectedCharacterIds: Set<string>;

    constructor(
        app: App,
        characterManager: CharacterManager,
        currentCharacters: CharacterConfig[],
        onSave: (characters: CharacterConfig[]) => void
    ) {
        super(app);
        this.characterManager = characterManager;
        this.currentCharacters = currentCharacters;
        this.onSave = onSave;
        this.selectedCharacterIds = new Set(currentCharacters.map(c => c.id));
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('character-editor-modal');

        contentEl.createEl('h2', { text: '👥 角色管理' });

        // 当前角色列表
        const allCharacters = [
            ...this.characterManager.getTeachers(),
            ...this.characterManager.getStudents()
        ];

        // 选择区域
        const selectSection = contentEl.createDiv({ cls: 'character-select-section' });
        selectSection.createEl('h3', { text: '选择参与讨论的角色' });

        const characterGrid = selectSection.createDiv({ cls: 'character-grid' });

        allCharacters.forEach((c: CharacterConfig) => {
            const isSelected = this.selectedCharacterIds.has(c.id);

            const charCard = characterGrid.createDiv({
                cls: `character-card ${isSelected ? 'selected' : ''}`
            });

            // 头像显示
            const avatarEl = charCard.createEl('div', { cls: 'character-avatar' });
            if (c.avatarPath) {
                const img = avatarEl.createEl('img', { cls: 'avatar-img' });
                img.src = `data:image/jpeg;base64,${c.avatarPath}`;
            } else {
                avatarEl.setText(c.avatar || '🤖');
            }
            
            charCard.createEl('div', { text: c.name, cls: 'character-name' });
            charCard.createEl('div', { text: c.type === 'teacher' ? '教学' : '学生', cls: 'character-type' });

            charCard.addEventListener('click', () => {
                if (this.selectedCharacterIds.has(c.id)) {
                    this.selectedCharacterIds.delete(c.id);
                    charCard.removeClass('selected');
                } else {
                    this.selectedCharacterIds.add(c.id);
                    charCard.addClass('selected');
                }
            });
        });

        // 按钮
        new Setting(contentEl)
            .addButton(btn => {
                btn.setButtonText('取消')
                    .onClick(() => this.close());
            })
            .addButton(btn => {
                btn.setButtonText('确认')
                    .setCta()
                    .onClick(() => {
                        const selectedCharacters = allCharacters.filter(c =>
                            this.selectedCharacterIds.has(c.id)
                        );
                        this.onSave(selectedCharacters);
                        this.close();
                    });
            });
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 完整的角色编辑器
class FullCharacterEditorModal extends Modal {
    private characterManager: CharacterManager;
    private onSave: () => void;
    private onCharacterCreated?: (characterId: string) => void;
    private editingCharacter: CharacterConfig | null = null;
    private avatarData: string = '';
    private avatarMime: string = '';
    private newCharacterType: 'teacher' | 'student' | null = null;

    constructor(
        app: App,
        characterManager: CharacterManager,
        onSave: () => void,
        character?: CharacterConfig,
        onCharacterCreated?: (characterId: string) => void
    ) {
        super(app);
        this.characterManager = characterManager;
        this.onSave = onSave;
        this.onCharacterCreated = onCharacterCreated;
        
        // 只有当 character 有 id 时才认为是编辑模式
        if (character?.id) {
            this.editingCharacter = character;
            if (character.avatarPath) {
                this.avatarData = character.avatarPath;
            }
        } else if (character?.type) {
            // 创建新角色，但指定了类型
            this.newCharacterType = character.type as 'teacher' | 'student';
        }
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('full-character-editor-modal');

        const isNew = !this.editingCharacter;
        contentEl.createEl('h2', { text: isNew ? '✨ 创建新角色' : '✏️ 编辑角色' });

        let name = this.editingCharacter?.name || '';
        let type = this.editingCharacter?.type || this.newCharacterType || 'teacher';
        let personality = this.editingCharacter?.personality || '';
        let background = this.editingCharacter?.background || '';
        let speakingStyle = this.editingCharacter?.speakingStyle || '';
        let attitude = this.editingCharacter?.attitude || '';
        let avatar = this.editingCharacter?.avatar || '🤖';
        let level = this.editingCharacter?.level || 'intermediate';

        // 头像上传区域
        const avatarSection = contentEl.createDiv({ cls: 'avatar-section' });
        const avatarPreview = avatarSection.createDiv({ cls: 'avatar-preview' });
        
        // 初始化头像预览
        if (this.avatarData) {
            const img = avatarPreview.createEl('img', { cls: 'avatar-img-preview' });
            img.src = `data:image/jpeg;base64,${this.avatarData}`;
        } else {
            avatarPreview.setText(avatar);
        }
        
        const avatarBtns = avatarSection.createDiv({ cls: 'avatar-buttons' });
        
        avatarBtns.createEl('button', { text: '😀 选择表情', cls: 'avatar-btn' })
            .addEventListener('click', () => {
                const emojiModal = new EmojiPickerModal(this.app, (emoji) => {
                    avatar = emoji;
                    avatarPreview.setText(emoji);
                    this.avatarData = '';
                });
                emojiModal.open();
            });

        avatarBtns.createEl('button', { text: '📷 上传图片', cls: 'avatar-btn' })
            .addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.addEventListener('change', async () => {
                    const file = input.files?.[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                            const base64 = (reader.result as string).split(',')[1];
                            this.avatarData = base64;
                            this.avatarMime = file.type;
                            // 显示预览
                            avatarPreview.empty();
                            const img = avatarPreview.createEl('img', { cls: 'avatar-img-preview' });
                            img.src = reader.result as string;
                        };
                        reader.readAsDataURL(file);
                    }
                });
                input.click();
            });

        // 角色类型
        new Setting(contentEl)
            .setName('角色类型')
            .setDesc('选择角色的类型')
            .addDropdown(dropdown => {
                dropdown.addOption('teacher', '教学者');
                dropdown.addOption('student', '学生');
                dropdown.setValue(type);
                dropdown.onChange((v) => { type = v as 'teacher' | 'student'; });
            });

        // 名字
        new Setting(contentEl)
            .setName('角色名称')
            .setDesc('角色的名字')
            .addText(text => {
                text.setValue(name);
                text.onChange((v) => { name = v; });
                text.inputEl.style.width = '100%';
            });

        // 学生水平（仅学生类型显示）
        const levelSetting = new Setting(contentEl)
            .setName('学生水平')
            .setDesc('学生角色的知识水平')
            .addDropdown(dropdown => {
                dropdown.addOption('beginner', '初学者');
                dropdown.addOption('intermediate', '中等');
                dropdown.addOption('advanced', '进阶');
                dropdown.setValue(level);
                dropdown.onChange((v) => { level = v as 'beginner' | 'intermediate' | 'advanced'; });
            });

        // 性格
        new Setting(contentEl)
            .setName('性格特点')
            .setDesc('角色的性格描述')
            .addTextArea(text => {
                text.setValue(personality);
                text.onChange((v) => { personality = v; });
                text.inputEl.rows = 3;
                text.inputEl.style.width = '100%';
            });

        // 背景
        new Setting(contentEl)
            .setName('角色背景')
            .setDesc('角色的背景故事')
            .addTextArea(text => {
                text.setValue(background);
                text.onChange((v) => { background = v; });
                text.inputEl.rows = 4;
                text.inputEl.style.width = '100%';
            });

        // 说话风格
        new Setting(contentEl)
            .setName('说话风格')
            .setDesc('角色的说话方式和习惯用语')
            .addTextArea(text => {
                text.setValue(speakingStyle);
                text.onChange((v) => { speakingStyle = v; });
                text.inputEl.rows = 3;
                text.inputEl.style.width = '100%';
            });

        // 初始态度
        new Setting(contentEl)
            .setName('初始态度')
            .setDesc('角色对学习者的初始态度')
            .addTextArea(text => {
                text.setValue(attitude);
                text.onChange((v) => { attitude = v; });
                text.inputEl.rows = 2;
                text.inputEl.style.width = '100%';
            });

        // 按钮
        new Setting(contentEl)
            .addButton(btn => {
                btn.setButtonText('取消')
                    .onClick(() => this.close());
            })
            .addButton(btn => {
                btn.setButtonText(isNew ? '创建' : '保存')
                    .setCta()
                    .onClick(async () => {
                        if (!name.trim()) {
                            new Notice('请输入角色名称');
                            return;
                        }

                        const charData: CharacterConfig = {
                            id: this.editingCharacter?.id || `custom-${Date.now()}`,
                            name: name.trim(),
                            type: type as 'teacher' | 'student',
                            personality: personality.trim(),
                            background: background.trim(),
                            speakingStyle: speakingStyle.trim(),
                            attitude: attitude.trim(),
                            avatar: this.avatarData ? undefined : avatar,
                            avatarPath: this.avatarData || undefined,
                            isCustom: true,
                            level: type === 'student' ? level as 'beginner' | 'intermediate' | 'advanced' : undefined
                        };

                        console.log('[AI Companion] 准备保存角色数据:', {
                            name: charData.name,
                            avatar: charData.avatar,
                            avatarPathLength: charData.avatarPath?.length,
                            hasAvatarPath: !!charData.avatarPath
                        });

                        if (this.editingCharacter) {
                            this.characterManager.updateCharacter(this.editingCharacter.id, charData);
                            console.log('[AI Companion] 更新角色:', charData);
                            new Notice(`已更新角色：${name}`);
                        } else {
                            const newChar = this.characterManager.addCharacter(charData);
                            console.log('[AI Companion] 创建角色:', charData);
                            console.log('[AI Companion] 当前所有教学角色:', this.characterManager.getTeachers());
                            new Notice(`已创建角色：${name}`);
                            
                            // 如果是新创建的角色，调用回调自动选中
                            if (this.onCharacterCreated) {
                                this.onCharacterCreated(newChar.id);
                            }
                        }

                        console.log('[AI Companion] 调用 onSave 回调');
                        await this.onSave();
                        this.close();
                    });
            });

        // 删除按钮（仅编辑模式）
        if (this.editingCharacter?.isCustom) {
            new Setting(contentEl)
                .addButton(btn => {
                    btn.setButtonText('🗑️ 删除此角色')
                        .setWarning()
                        .onClick(() => {
                            this.characterManager.removeCharacter(this.editingCharacter!.id);
                            new Notice('角色已删除');
                            this.onSave();
                            this.close();
                        });
                });
        }
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 表情选择器
class EmojiPickerModal extends Modal {
    private onSelect: (emoji: string) => void;
    private commonEmojis = [
        '😊', '😄', '🥰', '😎', '🤓', '😇', '🥳', '😋', '🤗', '😍',
        '🧑‍💻', '👨‍🏫', '👩‍🏫', '🧙‍♀️', '🧙‍♂️', '🦸‍♀️', '🦸‍♂️', '🧝‍♀️', '🧝‍♂️', '🤖',
        '💙', '💜', '💚', '💛', '🧡', '❤️', '💖', '✨', '🌟', '⭐',
        '📚', '💡', '🎯', '🔮', '🎭', '🎨', '📝', '🎓', '🦊', '🐱'
    ];

    constructor(app: App, onSelect: (emoji: string) => void) {
        super(app);
        this.onSelect = onSelect;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h3', { text: '选择表情头像' });

        const grid = contentEl.createDiv({ cls: 'emoji-grid' });
        
        for (const emoji of this.commonEmojis) {
            const btn = grid.createEl('button', { cls: 'emoji-btn' });
            btn.setText(emoji);
            btn.addEventListener('click', () => {
                this.onSelect(emoji);
                this.close();
            });
        }
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 故事背景编辑器
class StoryBackgroundModal extends Modal {
    private plugin: AICompanionPlugin;
    private onSave: () => void;

    constructor(app: App, plugin: AICompanionPlugin, onSave: () => void) {
        super(app);
        this.plugin = plugin;
        this.onSave = onSave;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('story-background-modal');

        contentEl.createEl('h2', { text: '📖 故事背景设置' });

        let setting = this.plugin.settings.storyBackground.setting;
        let learnerProfile = this.plugin.settings.storyBackground.learnerProfile;
        let teamGoal = this.plugin.settings.storyBackground.teamGoal;
        let enabled = this.plugin.settings.storyBackground.enabled;

        // 启用开关
        new Setting(contentEl)
            .setName('启用故事背景')
            .setDesc('是否在对话中使用故事背景设定')
            .addToggle(toggle => {
                toggle.setValue(enabled);
                toggle.onChange((v) => { enabled = v; });
            });

        // 故事设定
        new Setting(contentEl)
            .setName('故事设定')
            .setDesc('整体故事背景（如：你是清华学生，隔壁住着三个计算机系的女生...）')
            .addTextArea(text => {
                text.setValue(setting);
                text.onChange((v) => { setting = v; });
                text.inputEl.rows = 5;
                text.inputEl.style.width = '100%';
            });

        // 学习者身份
        new Setting(contentEl)
            .setName('学习者身份')
            .setDesc('你在故事中的身份和背景')
            .addTextArea(text => {
                text.setValue(learnerProfile);
                text.onChange((v) => { learnerProfile = v; });
                text.inputEl.rows = 3;
                text.inputEl.style.width = '100%';
            });

        // 团队目标
        new Setting(contentEl)
            .setName('团队目标')
            .setDesc('你和角色们共同的目标（如：获得奖学金、赢得比赛）')
            .addTextArea(text => {
                text.setValue(teamGoal);
                text.onChange((v) => { teamGoal = v; });
                text.inputEl.rows = 3;
                text.inputEl.style.width = '100%';
            });

        // 按钮
        new Setting(contentEl)
            .addButton(btn => {
                btn.setButtonText('取消')
                    .onClick(() => this.close());
            })
            .addButton(btn => {
                btn.setButtonText('保存')
                    .setCta()
                    .onClick(async () => {
                        this.plugin.settings.storyBackground = {
                            enabled,
                            setting,
                            learnerProfile,
                            teamGoal
                        };
                        await this.plugin.saveSettings();
                        new Notice('故事背景已保存');
                        this.onSave();
                        this.close();
                    });
            });
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
