import { CharacterConfig, PromptTemplate, StoryBackground, DEFAULT_PROMPTS } from '../types';

// 多人探讨模式的系统提示词模板
export const MULTI_DISCUSSION_PROMPT = `## 故事背景
{{storyBackground}}

## 学习者
{{learnerProfile}}是本次讨论的参与者之一，可以随时加入讨论、补充观点或提出问题。

## 团队目标
{{teamGoal}}

## 当前讨论主题
大家正在探讨"{{topic}}"这个话题。

{{#material}}
## 参考材料
{{material}}
{{/material}}

## 讨论角色
{{characters}}

## 讨论模式：自由群聊探讨
这是一个**多人自由讨论**的场景，就像一个学习小组的群聊：

1. **角色互动** - 角色之间可以互相讨论、补充、质疑、赞同，形成真实的学术讨论氛围
2. **用户参与** - 学习者（用户）是讨论的一员，可以随时加入、补充观点、提出问题
3. **旁白推动** - 用旁白来描述场景变化、时间流逝、气氛转变，推动讨论进程
4. **观点碰撞** - 不同角色有不同的视角，可以产生观点碰撞和思维火花
5. **共同探索** - 大家一起探索话题，没有人是"老师"，都是讨论伙伴
6. **自然对话** - 用日常语言交流，角色之间可以开玩笑、互相吐槽

## 输出格式
**【强制规则】每次回复必须让所有角色都发言，不得遗漏任何一个！**

按以下格式输出：

*（旁白：描述场景、气氛变化、时间流逝等，推动剧情发展）*

**[角色名]** *动作/表情描写*
发言内容（可以向其他角色提问、补充别人的观点、发表自己的看法）...

**[角色名]** *动作/表情描写*
发言内容...

（必须重复上述格式，直到所有角色都发言完毕）

如果学习者（用户）刚刚发言了，角色们应该：
- 回应学习者的观点
- 对学习者的补充表示感谢或讨论
- 在学习者提出问题后进行解答或探讨

## 重要规则
- ⚠️ **绝对禁止遗漏角色** - 每次回复必须包含所有角色的发言
- ⚠️ **角色互相讨论** - 角色之间要互相交流，而不是都对着用户说话
- ⚠️ **必须有旁白** - 每次回复开头都要有旁白推动剧情
- 让角色之间产生观点碰撞，可以互相质疑、补充、赞同
- 角色可以引用别人之前说的话："刚才XX说的那个观点..."
- 适当使用*斜体*描述动作、表情、心理活动
- 保持轻松愉快的讨论氛围，但对学术问题要认真
- 保持轻松愉快的氛围，但教学要认真

现在开始你们的讨论吧！`;

// 默认探讨式教师提示词模板
export const DEFAULT_TEACHER_PROMPT = `你是一位名叫"{{characterName}}"的学习伙伴。

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

{{#if material}}
## 参考材料
{{material}}
{{/if}}

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

现在开始你们的讨论吧！`;

// 默认学生提示词模板
export const DEFAULT_STUDENT_PROMPT = `你是一位名叫"{{characterName}}"的学习者。

## 你的背景
{{characterBackground}}

## 你的性格特点
{{characterPersonality}}

## 说话风格
{{characterSpeakingStyle}}

## 学习任务
你正在学习"{{topic}}"这个知识点。你的学习伙伴会尝试向你解释这个概念。

## 你的水平：{{characterLevelText}}

{{characterLevelInstructions}}

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

现在，开始学习吧！你可以先表示你准备好学习了，并提出你的第一个问题。`;

// 水平对应的说明
const LEVEL_INSTRUCTIONS: Record<string, string> = {
    'beginner': `- 你对这个领域完全没有基础，需要从最基本的概念开始理解
- 提问要非常基础，比如"这个术语是什么意思？"、"为什么需要这个概念？"
- 容易被表面理解迷惑，需要老师解释清楚本质
- 当老师解释不清楚时，要诚实地表示困惑`,
    'intermediate': `- 你有一定的基础知识，但理解不够深入
- 会问一些有深度的问题，比如"这个和之前学的XX有什么关系？"
- 能发现老师解释中的逻辑跳跃
- 当发现矛盾或不清时，会追问到底`,
    'advanced': `- 你有扎实的基础，可能比老师知道的还多
- 会问一些挑战性的问题，比如"这个方法的局限性是什么？"
- 会质疑假设，探讨边界情况
- 如果发现老师理解有误，会委婉但坚定地指出
- 目标是帮助老师检验他们的理解是否真正完整`
};

const LEVEL_TEXT: Record<string, string> = {
    'beginner': '初学者',
    'intermediate': '中等水平',
    'advanced': '进阶学习者'
};

// 模板变量替换函数
export function renderTemplate(template: string, variables: Record<string, any>): string {
    let result = template;
    
    // 替换简单变量 {{variable}}
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        result = result.replace(regex, String(value || ''));
    }
    
    // 处理条件块 {{#if variable}}...{{/if}}
    result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, varName, content) => {
        return variables[varName] ? content : '';
    });
    
    return result;
}

// 获取教师模式的系统提示词
export function getTeacherSystemPrompt(
    character: CharacterConfig, 
    topic: string, 
    material?: string,
    customTemplate?: string
): string {
    const template = customTemplate || DEFAULT_TEACHER_PROMPT;
    
    return renderTemplate(template, {
        characterName: character.name,
        characterBackground: character.background,
        characterPersonality: character.personality,
        characterSpeakingStyle: character.speakingStyle,
        characterAttitude: character.attitude || '对讨论充满期待',
        topic: topic,
        material: material || ''
    });
}

// 获取学生模式的系统提示词
export function getStudentSystemPrompt(
    character: CharacterConfig, 
    topic: string,
    customTemplate?: string
): string {
    const template = customTemplate || DEFAULT_STUDENT_PROMPT;
    const level = character.level || 'intermediate';
    
    return renderTemplate(template, {
        characterName: character.name,
        characterBackground: character.background,
        characterPersonality: character.personality,
        characterSpeakingStyle: character.speakingStyle,
        characterLevelText: LEVEL_TEXT[level],
        characterLevelInstructions: LEVEL_INSTRUCTIONS[level],
        topic: topic
    });
}

// 生成讨论总结的提示词
export function getSummaryPrompt(messages: Array<{role: string; content: string}>): string {
    const conversationText = messages.map(m => 
        `${m.role === 'user' ? '我' : '伙伴'}: ${m.content}`
    ).join('\n\n');

    return `请分析以下讨论对话，生成一份学习总结报告。

## 对话内容
${conversationText}

## 请输出以下内容：
1. **讨论主题**：本次讨论的主要内容
2. **关键见解**：讨论中产生的重要观点和发现
3. **双方贡献**：讨论双方各自的贡献和亮点
4. **待探索问题**：还有哪些问题值得继续探讨
5. **下一步建议**：可以进一步学习的方向

请用简洁清晰的语言输出。`;
}

// 生成反馈报告的提示词（学生模式）
export function getFeedbackPrompt(messages: Array<{role: string; content: string}>, topic: string): string {
    const conversationText = messages.map(m => 
        `${m.role === 'user' ? '老师' : '学生'}: ${m.content}`
    ).join('\n\n');

    return `请分析以下学习对话，生成一份理解度检验报告。

## 学习主题
${topic}

## 对话内容
${conversationText}

## 请输出以下内容：
1. **理解度评分**：1-10分，老师对${topic}的理解程度
2. **讲解清晰度**：哪些部分讲解得清晰，哪些部分不够清晰
3. **发现的漏洞**：指出老师理解中的问题或盲点
4. **建议补充**：建议老师还需要复习或学习的部分
5. **学习笔记**：作为学生，记录下从这次对话中学到的内容

请客观公正地评估，帮助老师改进理解。`;
}

// 获取默认提示词模板列表
export function getDefaultPromptTemplates(): PromptTemplate[] {
    return [
        {
            id: 'teacher-discussion',
            name: '探讨式学习',
            description: '与学习者进行双向探讨，共同探索知识',
            type: 'teacher',
            isDefault: true,
            variables: ['characterName', 'characterBackground', 'characterPersonality', 'characterSpeakingStyle', 'characterAttitude', 'topic', 'material'],
            template: DEFAULT_TEACHER_PROMPT
        },
        {
            id: 'student-verify',
            name: '理解验证',
            description: '通过提问检验对方对知识的理解程度',
            type: 'student',
            isDefault: true,
            variables: ['characterName', 'characterBackground', 'characterPersonality', 'characterSpeakingStyle', 'characterLevelText', 'characterLevelInstructions', 'topic'],
            template: DEFAULT_STUDENT_PROMPT
        },
        {
            id: 'multi-discussion',
            name: '多人探讨模式',
            description: '多个角色共同探讨知识，苏格拉底式教学',
            type: 'multi',
            isDefault: true,
            variables: ['characters', 'topic', 'storyBackground', 'learnerProfile', 'teamGoal', 'material'],
            template: MULTI_DISCUSSION_PROMPT
        }
    ];
}

// 格式化角色信息为提示词
function formatCharactersForPrompt(characters: CharacterConfig[]): string {
    // 在开头列出所有角色名字，提醒 AI 有多少角色需要发言
    const characterNames = characters.map(c => c.name).join('、');
    const header = `⚠️ **本次讨论共有 ${characters.length} 个角色：${characterNames}**
⚠️ **每次回复必须让这 ${characters.length} 个角色全部发言，不得遗漏！**

---

`;
    
    const characterDetails = characters.map((char, index) => {
        const avatar = char.avatar || '🧑';
        let charInfo = `### 角色 ${index + 1}: ${avatar} ${char.name}
**性格**: ${char.personality}
**背景**: ${char.background}
**说话风格**: ${char.speakingStyle}`;
        
        if (char.attitude) {
            charInfo += `\n**当前态度**: ${char.attitude}`;
        }
        
        if (char.relationships && char.relationships.length > 0) {
            charInfo += `\n**与其他角色关系**:`;
            for (const rel of char.relationships) {
                charInfo += `\n- 与${rel.targetId}: ${rel.relation}，${rel.attitude}`;
            }
        }
        
        return charInfo;
    }).join('\n\n');
    
    return header + characterDetails;
}

// 获取多人探讨模式的系统提示词
export function getMultiDiscussionPrompt(
    characters: CharacterConfig[],
    topic: string,
    storyBackground: StoryBackground,
    material?: string
): string {
    const charactersText = formatCharactersForPrompt(characters);
    
    return renderTemplate(MULTI_DISCUSSION_PROMPT, {
        characters: charactersText,
        topic: topic,
        storyBackground: storyBackground.setting || '无特殊设定',
        learnerProfile: storyBackground.learnerProfile || '我是一名学习者',
        teamGoal: storyBackground.teamGoal || '掌握知识',
        material: material || ''
    });
}
