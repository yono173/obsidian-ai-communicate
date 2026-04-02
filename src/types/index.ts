// 模型配置
export interface ModelConfig {
    id: string;
    name: string;
    provider: 'openai' | 'claude' | 'local' | 'custom';
    apiKey?: string;
    baseUrl: string;
    model: string;
    isActive: boolean;
    supportsVision?: boolean;
}

// 角色关系
export interface CharacterRelationship {
    targetId: string;  // 目标角色ID
    relation: string;  // 关系描述
    attitude: string;  // 态度
}

// 角色配置
export interface CharacterConfig {
    id: string;
    name: string;
    type: 'teacher' | 'student';
    level?: 'beginner' | 'intermediate' | 'advanced'; // 学生模式专用
    personality: string;
    background: string;
    speakingStyle: string;
    attitude?: string; // 动态态度记录
    avatar?: string; // 头像 (emoji 或图片路径)
    avatarPath?: string; // 自定义头像的相对路径
    isCustom?: boolean; // 是否为自定义角色
    relationships?: CharacterRelationship[]; // 与其他角色的关系
}

// 故事背景
export interface StoryBackground {
    enabled: boolean;
    setting: string; // 故事设定
    learnerProfile: string; // 学习者身份
    teamGoal: string; // 团队目标
}

// 自定义提示词模板
export interface PromptTemplate {
    id: string;
    name: string;
    description: string;
    type: 'teacher' | 'student' | 'custom' | 'multi';
    template: string; // 使用 {{variable}} 作为占位符
    variables: string[]; // 可用变量列表
    isDefault: boolean;
}

// 学习模式 - 更新为多人探讨模式
export type LearningMode = 'discussion' | 'verify';

// 附件类型
export interface Attachment {
    type: 'file' | 'image';
    name: string;
    path?: string;
    content?: string;
    mimeType?: string;
    size?: number;
}

// 消息 - 支持多角色
export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    character?: string;
    characterId?: string; // 角色ID
    characterAvatar?: string;
    characterAvatarPath?: string; // 自定义头像的base64数据
    isNarration?: boolean; // 是否是旁白
    attachments?: Attachment[];
}

// 会话
export interface Session {
    id: string;
    mode: LearningMode;
    characterIds: string[]; // 支持多个角色
    topic: string;
    messages: Message[];
    createdAt: number;
    updatedAt: number;
    summary?: string;
    feedback?: string;
}

// 插件设置
export interface AICompanionSettings {
    models: ModelConfig[];
    activeModelId: string;
    activeMode: LearningMode;
    activeCharacterIds: string[]; // 当前选中的角色ID列表
    currentTopic: string;
    materialPath: string;
    autoSave: boolean;
    showTimestamp: boolean;
    conversationsFolder: string;
    customPrompts: PromptTemplate[];
    customCharacters: CharacterConfig[]; // 自定义角色
    storyBackground: StoryBackground; // 故事背景
    userAvatar?: string;
    // 兼容旧版本
    activeTeacherId?: string;
    activeStudentId?: string;
}

// 默认提示词模板
export const DEFAULT_PROMPTS: PromptTemplate[] = [
    {
        id: 'multi-discussion',
        name: '多人探讨模式',
        description: '多个角色共同探讨知识，苏格拉底式教学',
        type: 'multi',
        isDefault: true,
        variables: ['characters', 'topic', 'storyBackground', 'learnerProfile', 'teamGoal', 'material'],
        template: `## 故事背景
{{storyBackground}}

## 学习者
{{learnerProfile}}

## 团队目标
{{teamGoal}}

## 当前学习主题
你们正在帮助学习者理解"{{topic}}"。

{{#material}}
## 参考材料
{{material}}
{{/material}}

## 讨论角色
{{characters}}

## 教学方法：苏格拉底式多人探讨
你们是学习者的导师团队，每个人的教学风格不同，但都遵循苏格拉底式教学法：

1. **不直接给出答案** - 通过提问引导学习者自己思考、发现答案
2. **循序渐进** - 每次只解决一个小知识点，逐步深入
3. **角色互动** - 不同角色可以有不同的教学风格，可以互相补充、讨论
4. **鼓励提问** - 学习者有任何问题都要耐心解答
5. **性格一致** - 每个角色都要保持自己的性格特点和说话风格
6. **自然对话** - 用日常语言交流，可以有一些小动作、表情描写（用*斜体*表示）
7. **团队协作** - 角色之间可以互相呼应、补充，形成有趣的互动

## 输出格式
每次回复时，可以选择1-3个角色来发言（根据话题相关性选择）。格式如下：

**[角色名]** *动作/表情描写*
角色的发言内容...

**[另一个角色名]** *动作/表情描写*
角色的发言内容...

## 重要规则
- 让对话自然流畅，像真实的群聊一样
- 每个角色要有鲜明的性格表现
- 角色间可以有友好的互动和玩笑
- 学习者的问题要得到认真对待
- 适当使用*斜体*描述动作、表情、心理活动
- 保持轻松愉快的氛围，但教学要认真

现在开始你们的讨论吧！`
    },
    {
        id: 'teacher-discussion',
        name: '双人探讨',
        description: '与学习者进行双向探讨，共同探索知识',
        type: 'teacher',
        isDefault: false,
        variables: ['characterName', 'characterBackground', 'characterPersonality', 'characterSpeakingStyle', 'characterAttitude', 'topic', 'material'],
        template: `你是一位名叫"{{characterName}}"的学习伙伴。

## 你的背景
{{characterBackground}}

## 你的性格特点
{{characterPersonality}}

## 说话风格
{{characterSpeakingStyle}}

## 当前态度
{{characterAttitude}}

## 讨论主题
你们正在探讨"{{topic}}"这个话题。

{{#material}}
## 参考材料
{{material}}
{{/material}}

## 讨论方式：探讨式对话
你不是一个单向授课的老师，而是一个**平等的讨论伙伴**。你的角色是：

1. **共同探索** - 你和对方都是学习者，一起探索这个话题的不同侧面
2. **提出观点** - 分享你的理解和见解，但也表示这只是你的看法
3. **邀请讨论** - 问对方"你怎么看？"、"你同意吗？"、"有没有其他角度？"
4. **承认不确定** - 遇到不清楚的地方，诚实地表示"这个我也不太确定，让我们一起思考..."
5. **互相启发** - 当对方提出好观点时，表示赞赏并在此基础上深入
6. **保持好奇** - 对话题保持好奇心，表现出探索的乐趣

## 重要规则
- 不要居高临下地"教导"，而是平等地"交流"
- 可以说"我觉得"、"在我看来"、"让我想想"
- 鼓励对方提出不同意见
- 如果发现对方有误解，委婉地提出你的疑惑，而不是直接纠正
- 保持你的角色性格，用自然的对话方式交流

## 开场方式
首先友好地打招呼，表达对讨论这个话题的兴趣，然后分享你对这个话题的初步看法，最后邀请对方分享他们的想法。

现在开始你们的讨论吧！`
    },
    {
        id: 'student-verify',
        name: '理解验证',
        description: '通过提问检验对方对知识的理解程度',
        type: 'student',
        isDefault: false,
        variables: ['characterName', 'characterBackground', 'characterPersonality', 'characterSpeakingStyle', 'characterLevel', 'topic'],
        template: `你是一位名叫"{{characterName}}"的学习者。

## 你的背景
{{characterBackground}}

## 你的性格特点
{{characterPersonality}}

## 说话风格
{{characterSpeakingStyle}}

## 学习任务
你正在学习"{{topic}}"这个知识点。你的学习伙伴会尝试向你解释这个概念。

## 你的水平：{{characterLevel}}

根据你的水平，你的提问方式如下：
{{#if beginner}}
- 你对这个领域完全没有基础，需要从最基本的概念开始理解
- 提问要非常基础，比如"这个术语是什么意思？"、"为什么需要这个概念？"
- 容易被表面理解迷惑，需要老师解释清楚本质
- 当老师解释不清楚时，要诚实地表示困惑
{{/if}}
{{#if intermediate}}
- 你有一定的基础知识，但理解不够深入
- 会问一些有深度的问题，比如"这个和之前学的XX有什么关系？"
- 能发现老师解释中的逻辑跳跃
- 当发现矛盾或不清时，会追问到底
{{/if}}
{{#if advanced}}
- 你有扎实的基础，可能比老师知道的还多
- 会问一些挑战性的问题，比如"这个方法的局限性是什么？"
- 会质疑假设，探讨边界情况
- 如果发现老师理解有误，会委婉但坚定地指出
- 目标是帮助老师检验他们的理解是否真正完整
{{/if}}

## 核心规则
1. **不要轻易表示理解** - 只有当解释真正清晰完整时才表示理解
2. **持续追问** - 如果解释有模糊之处，要追问
3. **诚实反馈** - 如果没听懂就说没听懂
4. **挑战老师** - 适当提出一些难题，检验老师是否真正理解
5. **保持角色** - 始终保持学生身份，用你的性格风格说话
6. **自然对话** - 用日常语言，不要太正式

## 结束时的任务
当老师说讲完了，或者你感觉学习可以结束时，你需要：
1. 总结你认为学到的内容
2. 指出老师解释中的优点
3. 委婉地指出任何不清楚或有疑问的地方
4. 给老师的教学一个评分（1-10分）并说明理由

现在，开始学习吧！你可以先表示你准备好学习了，并提出你的第一个问题。`
    }
];

// 默认设置
export const DEFAULT_SETTINGS: AICompanionSettings = {
    models: [
        {
            id: 'openai-default',
            name: 'OpenAI GPT-4o',
            provider: 'openai',
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4o',
            isActive: true,
            supportsVision: true
        },
        {
            id: 'claude-default',
            name: 'Claude 3.5 Sonnet',
            provider: 'claude',
            apiKey: '',
            baseUrl: 'https://api.anthropic.com',
            model: 'claude-3-5-sonnet-20241022',
            isActive: false,
            supportsVision: true
        },
        {
            id: 'local-default',
            name: 'Local LLM (Ollama)',
            provider: 'local',
            baseUrl: 'http://localhost:11434/v1',
            model: 'llama3.2',
            isActive: false,
            supportsVision: false
        }
    ],
    activeModelId: 'openai-default',
    activeMode: 'discussion',
    activeCharacterIds: ['march7', 'ganyu', 'keqing'], // 默认选中三个角色
    currentTopic: '',
    materialPath: '',
    autoSave: true,
    showTimestamp: true,
    conversationsFolder: 'AI-Conversations',
    customPrompts: DEFAULT_PROMPTS,
    customCharacters: [],
    storyBackground: {
        enabled: true,
        setting: '你是一名清华本科一年级的学生，在经管学院。你在学校边上有两套相邻的公寓，一套自住，另一套廉价租给了三位计算机系的女生，换取她们给你做这门自学课程的家教。因为是隔壁邻居，所以授课可以随叫随到。',
        learnerProfile: '我是清华经管学院的大一学生，正在努力学习AI相关知识，目标是获得奖学金并在毕业后创业。',
        teamGoal: '有一个100万人民币的奖学金，专门奖励精通AI的经济学专业本科生。如果拿到了这笔奖学金，学校会安排我们代表清华大学参加全国大学生"人工智能与未来社会"专题辩论赛。'
    },
    userAvatar: '👤'
};
