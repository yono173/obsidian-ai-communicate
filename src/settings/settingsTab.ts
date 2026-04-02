import { App, PluginSettingTab, Setting, Notice, Modal } from 'obsidian';
import type AICompanionPlugin from '../main';
import { ModelConfig, LearningMode } from '../types';

export class AICompanionSettingTab extends PluginSettingTab {
    plugin: AICompanionPlugin;

    constructor(app: App, plugin: AICompanionPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('ai-companion-settings');

        // 标题
        containerEl.createEl('h2', { text: 'AI 学习伴侣设置' });

        // 模型设置区域
        this.renderModelSettings(containerEl);

        // 学习模式设置
        this.renderModeSettings(containerEl);

        // 高级设置
        this.renderAdvancedSettings(containerEl);
    }

    private renderModelSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '模型配置' });

        // 当前选择的模型
        const activeModel = this.plugin.settings.models.find(
            m => m.id === this.plugin.settings.activeModelId
        );

        new Setting(containerEl)
            .setName('选择模型')
            .setDesc('选择要使用的 AI 模型')
            .addDropdown(dropdown => {
                this.plugin.settings.models.forEach(model => {
                    dropdown.addOption(model.id, model.name);
                });
                dropdown.setValue(this.plugin.settings.activeModelId);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.activeModelId = value;
                    await this.plugin.saveSettings();
                });
            });

        // 模型列表
        containerEl.createEl('h4', { text: '模型列表' });

        this.plugin.settings.models.forEach((model, index) => {
            this.renderModelCard(containerEl, model, index);
        });

        // 添加新模型按钮
        new Setting(containerEl)
            .setName('添加自定义模型')
            .setDesc('添加一个新的 API 配置')
            .addButton(btn => {
                btn.setButtonText('添加模型')
                    .onClick(() => {
                        this.addNewModel();
                    });
            });
    }

    private renderModelCard(containerEl: HTMLElement, model: ModelConfig, index: number): void {
        const card = containerEl.createDiv({ cls: 'model-card' });
        
        new Setting(card)
            .setName(model.name)
            .setDesc(`Provider: ${model.provider} | Model: ${model.model}`)
            .addText(text => {
                text.setPlaceholder('API Key')
                    .setValue(model.apiKey || '')
                    .onChange(async (value) => {
                        this.plugin.settings.models[index].apiKey = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.type = 'password';
            })
            .addButton(btn => {
                btn.setIcon('settings')
                    .setTooltip('编辑')
                    .onClick(() => {
                        this.showModelEditModal(model, index);
                    });
            })
            .addButton(btn => {
                btn.setIcon('trash')
                    .setTooltip('删除')
                    .setDisabled(this.plugin.settings.models.length <= 1)
                    .onClick(async () => {
                        if (this.plugin.settings.models.length > 1) {
                            this.plugin.settings.models.splice(index, 1);
                            await this.plugin.saveSettings();
                            this.display();
                        }
                    });
            });
    }

    private showModelEditModal(model: ModelConfig, index: number): void {
        const modal = new ModelEditModal(this.app, model, async (updated) => {
            this.plugin.settings.models[index] = updated;
            await this.plugin.saveSettings();
            this.display();
        });
        modal.open();
    }

    private async addNewModel(): Promise<void> {
        const newModel: ModelConfig = {
            id: `custom-${Date.now()}`,
            name: '新模型',
            provider: 'custom',
            apiKey: '',
            baseUrl: '',
            model: '',
            isActive: true
        };
        this.plugin.settings.models.push(newModel);
        await this.plugin.saveSettings();
        this.display();
    }

    private renderModeSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '学习模式' });

        new Setting(containerEl)
            .setName('默认模式')
            .setDesc('选择默认的学习模式')
            .addDropdown(dropdown => {
                dropdown.addOption('teacher', 'AI 老师模式（苏格拉底式教学）');
                dropdown.addOption('student', 'AI 学生模式（费曼技巧验证）');
                dropdown.setValue(this.plugin.settings.activeMode);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.activeMode = value as LearningMode;
                    await this.plugin.saveSettings();
                });
            });

        // 教师角色选择
        const teachers = this.plugin.characterManager.getTeachers();
        new Setting(containerEl)
            .setName('默认教师角色')
            .setDesc('选择 AI 教师的角色')
            .addDropdown(dropdown => {
                teachers.forEach(t => {
                    dropdown.addOption(t.id, t.name);
                });
                dropdown.setValue(this.plugin.settings.activeTeacherId || teachers[0]?.id || '');
                dropdown.onChange(async (value) => {
                    this.plugin.settings.activeTeacherId = value;
                    await this.plugin.saveSettings();
                });
            });

        // 学生角色选择
        const students = this.plugin.characterManager.getStudents();
        new Setting(containerEl)
            .setName('默认学生角色')
            .setDesc('选择 AI 学生的角色和水平')
            .addDropdown(dropdown => {
                students.forEach(s => {
                    dropdown.addOption(s.id, `${s.name} (${s.level === 'beginner' ? '初学者' : s.level === 'intermediate' ? '中等' : '进阶'})`);
                });
                dropdown.setValue(this.plugin.settings.activeStudentId || students[0]?.id || '');
                dropdown.onChange(async (value) => {
                    this.plugin.settings.activeStudentId = value;
                    await this.plugin.saveSettings();
                });
            });
    }

    private renderAdvancedSettings(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: '高级设置' });

        new Setting(containerEl)
            .setName('对话保存文件夹')
            .setDesc('保存 AI 对话的文件夹路径')
            .addText(text => {
                text.setValue(this.plugin.settings.conversationsFolder || 'AI-Conversations');
                text.onChange(async (value) => {
                    this.plugin.settings.conversationsFolder = value;
                    await this.plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName('自动保存会话')
            .setDesc('自动保存学习会话记录')
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.autoSave);
                toggle.onChange(async (value) => {
                    this.plugin.settings.autoSave = value;
                    await this.plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName('显示时间戳')
            .setDesc('在对话中显示消息时间')
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.showTimestamp);
                toggle.onChange(async (value) => {
                    this.plugin.settings.showTimestamp = value;
                    await this.plugin.saveSettings();
                });
            });
    }
}

// 模型编辑模态框

class ModelEditModal extends Modal {
    private model: ModelConfig;
    private onSave: (model: ModelConfig) => void;

    constructor(app: App, model: ModelConfig, onSave: (model: ModelConfig) => void) {
        super(app);
        this.model = { ...model };
        this.onSave = onSave;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: '编辑模型配置' });

        new Setting(contentEl)
            .setName('模型名称')
            .addText(text => {
                text.setValue(this.model.name);
                text.onChange((value) => {
                    this.model.name = value;
                });
            });

        new Setting(contentEl)
            .setName('Provider')
            .addDropdown(dropdown => {
                dropdown.addOption('openai', 'OpenAI');
                dropdown.addOption('claude', 'Claude');
                dropdown.addOption('local', 'Local (Ollama)');
                dropdown.addOption('custom', 'Custom');
                dropdown.setValue(this.model.provider);
                dropdown.onChange((value) => {
                    this.model.provider = value as ModelConfig['provider'];
                });
            });

        new Setting(contentEl)
            .setName('模型 ID')
            .setDesc('例如: gpt-4, claude-3-opus-20240229')
            .addText(text => {
                text.setValue(this.model.model);
                text.onChange((value) => {
                    this.model.model = value;
                });
            });

        new Setting(contentEl)
            .setName('API Base URL')
            .setDesc('API 端点地址')
            .addText(text => {
                text.setValue(this.model.baseUrl);
                text.onChange((value) => {
                    this.model.baseUrl = value;
                });
            });

        new Setting(contentEl)
            .setName('API Key')
            .addText(text => {
                text.setValue(this.model.apiKey || '');
                text.onChange((value) => {
                    this.model.apiKey = value;
                });
                text.inputEl.type = 'password';
            });

        new Setting(contentEl)
            .addButton(btn => {
                btn.setButtonText('取消')
                    .onClick(() => {
                        this.close();
                    });
            })
            .addButton(btn => {
                btn.setButtonText('保存')
                    .setCta()
                    .onClick(() => {
                        this.onSave(this.model);
                        this.close();
                    });
            });
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
