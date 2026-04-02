import { Plugin, WorkspaceLeaf, addIcon } from 'obsidian';
import { AICompanionSettings, DEFAULT_SETTINGS } from './types';
import { AICompanionSettingTab } from './settings/settingsTab';
import { ChatView, VIEW_TYPE } from './views/chatView';
import { CharacterManager } from './services/characterManager';

export default class AICompanionPlugin extends Plugin {
    settings: AICompanionSettings;
    characterManager: CharacterManager;

    async onload(): Promise<void> {
        console.log('Loading AI Learning Companion');

        await this.loadSettings();
        // 使用自定义角色初始化角色管理器
        this.characterManager = new CharacterManager(this.settings.customCharacters || []);

        addIcon('graduation-cap', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
            <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/>
        </svg>`);

        this.registerView(VIEW_TYPE, (leaf) => new ChatView(leaf, this));

        this.addRibbonIcon('graduation-cap', 'AI 学习伴侣', () => {
            this.activateView();
        });

        this.addCommand({
            id: 'open-ai-companion',
            name: '打开 AI 学习伴侣',
            callback: () => {
                this.activateView();
            }
        });

        this.addCommand({
            id: 'attach-current-file',
            name: '附加当前文件到对话',
            callback: () => {
                this.attachCurrentFile();
            }
        });

        this.addSettingTab(new AICompanionSettingTab(this.app, this));
        this.loadStyles();
    }

    async onunload(): Promise<void> {
        console.log('Unloading AI Learning Companion');
        this.app.workspace.detachLeavesOfType(VIEW_TYPE);
    }

    async loadSettings(): Promise<void> {
        const loadedData = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
        
        // 迁移旧版本设置
        if (!this.settings.activeCharacterIds) {
            this.settings.activeCharacterIds = [];
            // 从旧设置迁移
            if (this.settings.activeTeacherId) {
                this.settings.activeCharacterIds.push(this.settings.activeTeacherId);
            }
        }
        
        if (!this.settings.customCharacters) {
            this.settings.customCharacters = [];
        }
        
        if (!this.settings.storyBackground) {
            this.settings.storyBackground = DEFAULT_SETTINGS.storyBackground;
        }
    }

    async saveSettings(): Promise<void> {
        // 保存时更新自定义角色
        this.settings.customCharacters = this.characterManager.getCustomCharacters();
        await this.saveData(this.settings);
    }

    async activateView(): Promise<void> {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({
                    type: VIEW_TYPE,
                    active: true
                });
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    private async attachCurrentFile(): Promise<void> {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
            return;
        }
        // 这个功能需要 ChatView 实例，通过事件机制实现
        this.app.workspace.trigger('ai-companion:attach-file', file);
    }

    private loadStyles(): void {
        const style = document.createElement('style');
        style.id = 'ai-companion-styles';
        style.textContent = `
            /* AI Learning Companion Styles */
            
            .ai-companion-container {
                display: flex;
                flex-direction: column;
                height: 100%;
                padding: 0;
            }

            .ai-companion-header {
                padding: 12px;
                border-bottom: 1px solid var(--background-modifier-border);
                background: var(--background-secondary);
            }

            .mode-switcher {
                display: flex;
                gap: 8px;
                margin-bottom: 12px;
            }

            .mode-btn {
                flex: 1;
                padding: 10px 16px;
                border: 1px solid var(--background-modifier-border);
                background: var(--background-primary);
                color: var(--text-normal);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 14px;
            }

            .mode-btn:hover {
                background: var(--background-modifier-hover);
            }

            .mode-btn.active {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border-color: var(--interactive-accent);
            }

            .mode-indicator {
                font-size: 12px;
                color: var(--text-muted);
                margin-top: 8px;
            }

            .topic-indicator {
                color: var(--text-accent);
            }

            .header-controls {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 12px;
            }

            .control-btn {
                padding: 6px 12px;
                font-size: 12px;
                border: 1px solid var(--background-modifier-border);
                background: var(--background-primary);
                color: var(--text-normal);
                border-radius: 4px;
                cursor: pointer;
            }

            .control-btn:hover {
                background: var(--background-modifier-hover);
            }

            .messages-container {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
                background: var(--background-primary);
            }

            /* 微信风格聊天消息样式 */
            .chat-message {
                display: flex;
                margin-bottom: 16px;
                align-items: flex-start;
                gap: 10px;
            }

            .chat-message-user {
                flex-direction: row-reverse;
            }

            .chat-avatar-wrapper {
                flex-shrink: 0;
            }

            .chat-avatar {
                width: 40px;
                height: 40px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                background: var(--background-secondary);
                overflow: hidden;
            }

            .chat-avatar .avatar-img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .chat-bubble-wrapper {
                display: flex;
                flex-direction: column;
                max-width: 70%;
            }

            .chat-message-user .chat-bubble-wrapper {
                align-items: flex-end;
            }

            .chat-message-ai .chat-bubble-wrapper {
                align-items: flex-start;
            }

            .chat-character-name {
                font-size: 12px;
                color: var(--text-muted);
                margin-bottom: 4px;
                margin-left: 4px;
            }

            .chat-bubble {
                padding: 10px 14px;
                border-radius: 12px;
                line-height: 1.6;
                position: relative;
            }

            .chat-message-user .chat-bubble {
                background: #07C160;
                color: #fff;
                border-top-right-radius: 4px;
            }

            .chat-message-ai .chat-bubble {
                background: var(--background-secondary);
                color: var(--text-normal);
                border-top-left-radius: 4px;
            }

            .chat-bubble-content p:first-child {
                margin-top: 0;
            }

            .chat-bubble-content p:last-child {
                margin-bottom: 0;
            }

            .chat-message-user .chat-bubble a {
                color: #fff;
                text-decoration: underline;
            }

            .chat-message-user .chat-bubble code {
                background: rgba(0,0,0,0.15);
                padding: 2px 6px;
                border-radius: 4px;
            }

            .chat-message-ai .chat-bubble pre {
                background: var(--background-primary);
                padding: 12px;
                border-radius: 8px;
                overflow-x: auto;
                margin: 8px 0;
            }

            .chat-message-ai .chat-bubble code {
                font-family: var(--font-monospace);
                font-size: 0.9em;
            }

            .chat-message-ai .chat-bubble ul,
            .chat-message-ai .chat-bubble ol {
                margin: 8px 0;
                padding-left: 20px;
            }

            .chat-message-ai .chat-bubble li {
                margin: 4px 0;
            }

            .chat-message-ai .chat-bubble blockquote {
                border-left: 3px solid var(--interactive-accent);
                margin: 8px 0;
                padding-left: 12px;
                color: var(--text-muted);
            }

            .chat-timestamp {
                font-size: 11px;
                color: var(--text-faint);
                margin-top: 4px;
                padding: 0 4px;
            }

            /* 旁白样式 */
            .chat-narration {
                text-align: center;
                padding: 16px 20px;
                margin: 12px 0;
            }

            .chat-narration-content {
                display: inline-block;
                padding: 10px 20px;
                background: linear-gradient(135deg, var(--background-secondary) 0%, var(--background-modifier-hover) 100%);
                border-radius: 20px;
                font-style: italic;
                color: var(--text-muted);
                font-size: 13px;
                max-width: 80%;
                line-height: 1.6;
                border-left: 3px solid var(--interactive-accent);
                border-right: 3px solid var(--interactive-accent);
            }

            /* 旧消息样式（保留兼容） */
            .message {
                margin-bottom: 16px;
                max-width: 85%;
            }

            .user-message {
                margin-left: auto;
            }

            .assistant-message {
                margin-right: auto;
            }

            .message-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 4px;
                font-size: 12px;
            }

            .message-role {
                font-weight: 600;
                color: var(--text-muted);
            }

            .message-time {
                color: var(--text-faint);
            }

            .message-content {
                padding: 12px 16px;
                border-radius: 12px;
                line-height: 1.6;
            }
            
            .message-content p:first-child {
                margin-top: 0;
            }
            
            .message-content p:last-child {
                margin-bottom: 0;
            }

            .user-message .message-content {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border-bottom-right-radius: 4px;
            }
            
            .user-message .message-content a {
                color: var(--text-on-accent);
                text-decoration: underline;
            }
            
            .user-message .message-content code {
                background: rgba(0,0,0,0.1);
                padding: 2px 6px;
                border-radius: 4px;
            }

            .assistant-message .message-content {
                background: var(--background-modifier-hover);
                color: var(--text-normal);
                border-bottom-left-radius: 4px;
            }
            
            .assistant-message .message-content pre {
                background: var(--background-primary);
                padding: 12px;
                border-radius: 8px;
                overflow-x: auto;
                margin: 8px 0;
            }
            
            .assistant-message .message-content code {
                font-family: var(--font-monospace);
                font-size: 0.9em;
            }
            
            .assistant-message .message-content ul,
            .assistant-message .message-content ol {
                margin: 8px 0;
                padding-left: 20px;
            }
            
            .assistant-message .message-content li {
                margin: 4px 0;
            }
            
            .assistant-message .message-content blockquote {
                border-left: 3px solid var(--interactive-accent);
                margin: 8px 0;
                padding-left: 12px;
                color: var(--text-muted);
            }
            
            .assistant-message .message-content h1,
            .assistant-message .message-content h2,
            .assistant-message .message-content h3 {
                margin: 12px 0 8px 0;
            }
            
            .assistant-message .message-content h1:first-child,
            .assistant-message .message-content h2:first-child,
            .assistant-message .message-content h3:first-child {
                margin-top: 0;
            }

            /* Attachments */
            .message-attachments {
                margin-bottom: 8px;
            }

            .attachment-image-container {
                max-width: 200px;
                margin-bottom: 4px;
            }

            .attachment-image {
                max-width: 100%;
                border-radius: 8px;
                cursor: pointer;
            }

            .attachment-file {
                padding: 8px 12px;
                background: var(--background-secondary);
                border-radius: 6px;
                margin-bottom: 4px;
            }

            .attachment-name {
                font-size: 12px;
                color: var(--text-muted);
            }

            .welcome-message {
                text-align: center;
                padding: 40px 20px;
                color: var(--text-muted);
            }

            .welcome-message h3 {
                color: var(--text-normal);
                margin-bottom: 16px;
            }

            .input-area {
                padding: 12px;
                border-top: 1px solid var(--background-modifier-border);
                background: var(--background-secondary);
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .attachments-preview {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 8px;
            }

            .attachment-preview-item {
                position: relative;
                background: var(--background-modifier-hover);
                border-radius: 8px;
                padding: 4px;
            }

            .preview-image {
                width: 60px;
                height: 60px;
                object-fit: cover;
                border-radius: 4px;
            }

            .attachment-preview-item > span {
                font-size: 12px;
                padding: 4px 8px;
            }

            .remove-attachment {
                position: absolute;
                top: -6px;
                right: -6px;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: var(--background-modifier-error);
                color: white;
                border: none;
                cursor: pointer;
                font-size: 12px;
                line-height: 1;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .attachment-buttons {
                display: flex;
                gap: 8px;
            }

            .attach-btn {
                padding: 6px 12px;
                font-size: 12px;
                border: 1px solid var(--background-modifier-border);
                background: var(--background-primary);
                color: var(--text-normal);
                border-radius: 4px;
                cursor: pointer;
            }

            .attach-btn:hover {
                background: var(--background-modifier-hover);
            }

            .message-input {
                width: 100%;
                padding: 12px;
                border: 1px solid var(--background-modifier-border);
                border-radius: 8px;
                background: var(--background-primary);
                color: var(--text-normal);
                font-size: 14px;
                resize: none;
                font-family: inherit;
                box-sizing: border-box;
            }

            .message-input:focus {
                outline: none;
                border-color: var(--interactive-accent);
            }

            .send-btn {
                padding: 12px 24px;
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                align-self: flex-end;
            }

            .send-btn:hover {
                filter: brightness(1.1);
            }

            .loading-indicator {
                text-align: center;
                padding: 12px;
                color: var(--text-muted);
                font-style: italic;
            }

            /* History Modal */
            .history-list {
                max-height: 500px;
                overflow-y: auto;
            }

            .history-item {
                display: flex;
                align-items: center;
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 8px;
                background: var(--background-secondary);
                gap: 12px;
            }

            .history-item:hover {
                background: var(--background-modifier-hover);
            }

            .history-info {
                flex: 1;
            }

            .history-name {
                font-weight: 600;
                margin-bottom: 4px;
            }

            .history-time {
                font-size: 12px;
                color: var(--text-muted);
            }

            .history-actions {
                display: flex;
                gap: 8px;
            }

            .history-btn {
                padding: 6px 12px;
                font-size: 12px;
                border: 1px solid var(--background-modifier-border);
                background: var(--background-primary);
                color: var(--text-normal);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .history-btn:hover {
                background: var(--background-modifier-hover);
            }

            .continue-btn {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border-color: var(--interactive-accent);
            }

            .continue-btn:hover {
                filter: brightness(1.1);
            }

            /* Settings Styles */
            .ai-companion-settings h3 {
                margin-top: 24px;
                border-bottom: 1px solid var(--background-modifier-border);
                padding-bottom: 8px;
            }

            .model-card {
                background: var(--background-secondary);
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 12px;
            }

            /* Summary Modal */
            .summary-content {
                max-height: 400px;
                overflow-y: auto;
                background: var(--background-secondary);
                padding: 16px;
                border-radius: 8px;
                margin: 16px 0;
            }

            .summary-content pre {
                white-space: pre-wrap;
                font-size: 13px;
                line-height: 1.5;
            }

            /* Message Avatar */
            .message-avatar {
                font-size: 20px;
                margin-right: 8px;
            }

            /* Character Selection */
            .character-selection {
                margin: 16px 0;
            }

            .character-selection h3 {
                margin-bottom: 12px;
            }

            .character-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 12px;
            }

            .character-card {
                padding: 16px;
                border: 2px solid var(--background-modifier-border);
                border-radius: 12px;
                cursor: pointer;
                text-align: center;
                transition: all 0.2s;
                background: var(--background-primary);
            }

            .character-card:hover {
                border-color: var(--interactive-accent);
            }

            .character-card.selected {
                border-color: var(--interactive-accent);
                background: var(--interactive-accent-hover);
            }

            .character-avatar {
                font-size: 36px;
                margin-bottom: 8px;
            }

            .character-name {
                font-weight: 600;
                margin-bottom: 4px;
            }

            .character-hint {
                font-size: 11px;
                color: var(--text-muted);
            }

            /* Prompt Editor */
            .prompt-editor-modal {
                max-width: 800px;
            }

            .prompt-list {
                display: flex;
                gap: 8px;
                margin-bottom: 16px;
                flex-wrap: wrap;
            }

            .prompt-item {
                padding: 8px 16px;
                border: 1px solid var(--background-modifier-border);
                border-radius: 8px;
                cursor: pointer;
                background: var(--background-primary);
            }

            .prompt-item:hover {
                background: var(--background-modifier-hover);
            }

            .prompt-item.active {
                border-color: var(--interactive-accent);
                background: var(--interactive-accent-hover);
            }

            .prompt-name {
                font-weight: 600;
            }

            .prompt-desc {
                font-size: 11px;
                color: var(--text-muted);
            }

            .prompt-editor-area {
                margin-top: 16px;
            }

            .variable-info {
                margin-bottom: 12px;
                padding: 12px;
                background: var(--background-secondary);
                border-radius: 8px;
            }

            .variable-info h4 {
                margin-bottom: 8px;
            }

            .variable-info ul {
                list-style: none;
                padding: 0;
                margin: 0;
            }

            .variable-info li {
                margin-bottom: 4px;
                font-size: 12px;
            }

            .variable-info code {
                background: var(--background-primary);
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 11px;
            }

            .prompt-textarea-container {
                margin-top: 12px;
            }

            .prompt-textarea {
                width: 100%;
                min-height: 300px;
                padding: 12px;
                border: 1px solid var(--background-modifier-border);
                border-radius: 8px;
                background: var(--background-primary);
                color: var(--text-normal);
                font-family: monospace;
                font-size: 13px;
                line-height: 1.5;
                resize: vertical;
                box-sizing: border-box;
            }

            .prompt-textarea:focus {
                outline: none;
                border-color: var(--interactive-accent);
            }

            /* Character Manager Modal */
            .character-manager-modal {
                max-width: 700px;
            }

            .character-tabs {
                display: flex;
                gap: 8px;
                margin-bottom: 16px;
            }

            .tab-btn {
                flex: 1;
                padding: 10px 16px;
                border: 1px solid var(--background-modifier-border);
                background: var(--background-primary);
                color: var(--text-normal);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .tab-btn.active {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border-color: var(--interactive-accent);
            }

            .character-list {
                max-height: 400px;
                overflow-y: auto;
            }

            .character-list-item {
                display: flex;
                align-items: center;
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 8px;
                background: var(--background-secondary);
                gap: 12px;
            }

            .character-list-item.selected {
                border: 2px solid var(--interactive-accent);
            }

            .item-avatar {
                font-size: 28px;
                width: 40px;
                height: 40px;
                text-align: center;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }

            .item-avatar .avatar-img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 8px;
            }

            .item-info {
                flex: 1;
            }

            .item-name {
                font-weight: 600;
                margin-bottom: 4px;
            }

            .item-hint {
                font-size: 12px;
                color: var(--text-muted);
            }

            .item-actions {
                display: flex;
                gap: 8px;
            }

            .select-btn {
                padding: 6px 12px;
                font-size: 12px;
                border: 1px solid var(--background-modifier-border);
                background: var(--background-primary);
                color: var(--text-normal);
                border-radius: 6px;
                cursor: pointer;
            }

            .select-btn.selected {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
                border-color: var(--interactive-accent);
            }

            .edit-btn {
                padding: 6px 10px;
                font-size: 12px;
                border: none;
                background: transparent;
                cursor: pointer;
                opacity: 0.7;
            }

            .edit-btn:hover {
                opacity: 1;
            }

            .create-character-btn {
                width: 100%;
                padding: 12px;
                margin-top: 12px;
                border: 2px dashed var(--background-modifier-border);
                background: transparent;
                color: var(--text-muted);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .create-character-btn:hover {
                border-color: var(--interactive-accent);
                color: var(--interactive-accent);
            }

            /* Full Character Editor */
            .full-character-editor-modal {
                max-width: 600px;
            }

            .avatar-section {
                display: flex;
                align-items: center;
                gap: 16px;
                margin: 16px 0;
                padding: 16px;
                background: var(--background-secondary);
                border-radius: 12px;
            }

            .avatar-preview {
                width: 64px;
                height: 64px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 36px;
                background: var(--background-primary);
                border-radius: 50%;
            }

            .avatar-img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
            }

            .avatar-img-preview {
                width: 64px;
                height: 64px;
                border-radius: 50%;
                object-fit: cover;
            }

            .avatar-buttons {
                display: flex;
                gap: 8px;
            }

            .avatar-btn {
                padding: 8px 16px;
                font-size: 12px;
                border: 1px solid var(--background-modifier-border);
                background: var(--background-primary);
                color: var(--text-normal);
                border-radius: 6px;
                cursor: pointer;
            }

            /* Story Background Modal */
            .story-background-modal {
                max-width: 650px;
            }

            /* Emoji Picker */
            .emoji-grid {
                display: grid;
                grid-template-columns: repeat(10, 1fr);
                gap: 8px;
                max-height: 200px;
                overflow-y: auto;
            }

            .emoji-btn {
                font-size: 24px;
                padding: 8px;
                border: none;
                background: transparent;
                cursor: pointer;
                border-radius: 8px;
            }

            .emoji-btn:hover {
                background: var(--background-modifier-hover);
            }
        `;
        document.head.appendChild(style);

        this.register(() => {
            style.remove();
        });
    }
}
