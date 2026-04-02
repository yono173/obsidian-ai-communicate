import { ModelConfig, Attachment } from '../types';

// 消息内容部分（支持多模态）
export interface ContentPart {
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
        url: string; // base64 data URL 或 http URL
    };
}

// 统一的聊天完成请求
export interface ChatCompletionRequest {
    messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string | ContentPart[];
    }>;
    temperature?: number;
    maxTokens?: number;
}

// 统一的聊天完成响应
export interface ChatCompletionResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
    };
}

// 模型适配器接口
export interface ModelAdapter {
    chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
}

// 将附件转换为内容部分
export function attachmentsToContentParts(
    text: string, 
    attachments?: Attachment[]
): string | ContentPart[] {
    if (!attachments || attachments.length === 0) {
        return text;
    }

    const parts: ContentPart[] = [{ type: 'text', text }];
    
    for (const attachment of attachments) {
        if (attachment.type === 'image' && attachment.content) {
            // 图片使用 base64 data URL
            const mimeType = attachment.mimeType || 'image/png';
            parts.push({
                type: 'image_url',
                image_url: {
                    url: `data:${mimeType};base64,${attachment.content}`
                }
            });
        } else if (attachment.type === 'file' && attachment.content) {
            // 文件内容追加到文本
            parts[0].text += `\n\n[附件: ${attachment.name}]\n\`\`\`\n${attachment.content}\n\`\`\``;
        }
    }
    
    return parts;
}

// OpenAI 适配器
export class OpenAIAdapter implements ModelAdapter {
    constructor(private config: ModelConfig) {}

    async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify({
                model: this.config.model,
                messages: request.messages,
                temperature: request.temperature ?? 0.7,
                max_tokens: request.maxTokens ?? 2000
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI API error: ${error}`);
        }

        const data = await response.json();
        return {
            content: data.choices[0].message.content,
            usage: {
                promptTokens: data.usage?.prompt_tokens ?? 0,
                completionTokens: data.usage?.completion_tokens ?? 0
            }
        };
    }
}

// Claude 适配器
export class ClaudeAdapter implements ModelAdapter {
    constructor(private config: ModelConfig) {}

    async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
        // Claude API 需要单独处理 system 消息
        const systemMessage = request.messages.find(m => m.role === 'system');
        const otherMessages = request.messages.filter(m => m.role !== 'system');

        // 转换消息格式为 Claude 格式
        const claudeMessages = otherMessages.map(m => {
            const content = m.content;
            
            // 如果是字符串，直接使用
            if (typeof content === 'string') {
                return { role: m.role, content };
            }
            
            // 如果是 ContentPart[]，转换为 Claude 格式
            const claudeContent: Array<{type: string; text?: string; source?: any}> = [];
            for (const part of content) {
                if (part.type === 'text') {
                    claudeContent.push({ type: 'text', text: part.text });
                } else if (part.type === 'image_url' && part.image_url) {
                    // 从 data URL 提取 base64 和 mime type
                    const matches = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
                    if (matches) {
                        const mimeType = matches[1];
                        const base64Data = matches[2];
                        // 根据 mime type 确定媒体类型
                        let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/png';
                        if (mimeType === 'image/jpeg') mediaType = 'image/jpeg';
                        else if (mimeType === 'image/gif') mediaType = 'image/gif';
                        else if (mimeType === 'image/webp') mediaType = 'image/webp';
                        
                        claudeContent.push({
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: mediaType,
                                data: base64Data
                            }
                        });
                    }
                }
            }
            
            return { role: m.role, content: claudeContent };
        });

        const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.config.apiKey || '',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: this.config.model,
                system: typeof systemMessage?.content === 'string' 
                    ? systemMessage.content 
                    : systemMessage?.content?.[0]?.text ?? '',
                messages: claudeMessages,
                max_tokens: request.maxTokens ?? 2000
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Claude API error: ${error}`);
        }

        const data = await response.json();
        return {
            content: data.content[0].text,
            usage: {
                promptTokens: data.usage?.input_tokens ?? 0,
                completionTokens: data.usage?.output_tokens ?? 0
            }
        };
    }
}

// 本地模型适配器 (Ollama/OpenAI 兼容)
export class LocalModelAdapter implements ModelAdapter {
    constructor(private config: ModelConfig) {}

    async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
        // 本地模型可能不支持多模态，转换为纯文本
        const textMessages = request.messages.map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : 
                m.content.map(p => p.text || '').join('\n')
        }));

        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.config.model,
                messages: textMessages,
                temperature: request.temperature ?? 0.7,
                max_tokens: request.maxTokens ?? 2000
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Local model API error: ${error}`);
        }

        const data = await response.json();
        return {
            content: data.choices[0].message.content,
            usage: {
                promptTokens: data.usage?.prompt_tokens ?? 0,
                completionTokens: data.usage?.completion_tokens ?? 0
            }
        };
    }
}

// 自定义 API 适配器
export class CustomAdapter implements ModelAdapter {
    constructor(private config: ModelConfig) {}

    async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        if (this.config.apiKey) {
            headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }

        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: this.config.model,
                messages: request.messages,
                temperature: request.temperature ?? 0.7,
                max_tokens: request.maxTokens ?? 2000
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Custom API error: ${error}`);
        }

        const data = await response.json();
        return {
            content: data.choices[0].message.content,
            usage: {
                promptTokens: data.usage?.prompt_tokens ?? 0,
                completionTokens: data.usage?.completion_tokens ?? 0
            }
        };
    }
}

// 创建适配器工厂
export function createAdapter(config: ModelConfig): ModelAdapter {
    switch (config.provider) {
        case 'openai':
            return new OpenAIAdapter(config);
        case 'claude':
            return new ClaudeAdapter(config);
        case 'local':
            return new LocalModelAdapter(config);
        case 'custom':
            return new CustomAdapter(config);
        default:
            throw new Error(`Unknown provider: ${config.provider}`);
    }
}
