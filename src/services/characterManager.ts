import { CharacterConfig } from '../types';
import { DEFAULT_TEACHERS, DEFAULT_STUDENTS } from './characters';

export class CharacterManager {
    private teachers: CharacterConfig[];
    private students: CharacterConfig[];
    private customCharacters: CharacterConfig[];

    constructor(customCharacters: CharacterConfig[] = []) {
        // 加载默认角色
        this.teachers = [...DEFAULT_TEACHERS];
        this.students = [...DEFAULT_STUDENTS];
        this.customCharacters = [...customCharacters];
        
        // 合并自定义角色
        this.mergeCustomCharacters();
    }

    private mergeCustomCharacters(): void {
        for (const char of this.customCharacters) {
            if (char.type === 'teacher') {
                // 检查是否已存在
                const existing = this.teachers.find(t => t.id === char.id);
                if (existing) {
                    // 更新现有角色
                    Object.assign(existing, char);
                } else {
                    this.teachers.push(char);
                }
            } else {
                const existing = this.students.find(s => s.id === char.id);
                if (existing) {
                    Object.assign(existing, char);
                } else {
                    this.students.push(char);
                }
            }
        }
    }

    // 重新加载自定义角色
    reloadCustomCharacters(customCharacters: CharacterConfig[]): void {
        this.customCharacters = [...customCharacters];
        // 重置为默认角色
        this.teachers = [...DEFAULT_TEACHERS];
        this.students = [...DEFAULT_STUDENTS];
        this.mergeCustomCharacters();
    }

    getTeachers(): CharacterConfig[] {
        return this.teachers;
    }

    getStudents(): CharacterConfig[] {
        return this.students;
    }

    // 获取所有教学角色（用于多人探讨模式）
    getAllTeachers(): CharacterConfig[] {
        return this.teachers;
    }

    getTeacher(id: string): CharacterConfig | undefined {
        return this.teachers.find(t => t.id === id);
    }

    getStudent(id: string): CharacterConfig | undefined {
        return this.students.find(s => s.id === id);
    }

    getCharacter(id: string): CharacterConfig | undefined {
        return this.teachers.find(t => t.id === id) || 
               this.students.find(s => s.id === id);
    }

    // 通过ID列表获取多个角色
    getCharactersByIds(ids: string[]): CharacterConfig[] {
        return ids
            .map(id => this.getCharacter(id))
            .filter((c): c is CharacterConfig => c !== undefined);
    }

    // 更新角色态度（动态演变）
    updateCharacterAttitude(id: string, newAttitude: string): void {
        const character = this.getCharacter(id);
        if (character) {
            character.attitude = newAttitude;
        }
    }

    // 添加自定义角色
    addCharacter(character: CharacterConfig): CharacterConfig {
        console.log('[CharacterManager] addCharacter 被调用，character:', character);
        const newChar = { ...character, isCustom: true };
        if (character.type === 'teacher') {
            // 检查是否已存在
            const existingIndex = this.teachers.findIndex(t => t.id === character.id);
            if (existingIndex !== -1) {
                this.teachers[existingIndex] = newChar;
            } else {
                this.teachers.push(newChar);
            }
        } else {
            const existingIndex = this.students.findIndex(s => s.id === character.id);
            if (existingIndex !== -1) {
                this.students[existingIndex] = newChar;
            } else {
                this.students.push(newChar);
            }
        }
        this.customCharacters.push(newChar);
        console.log('[CharacterManager] 添加后 customCharacters:', this.customCharacters);
        console.log('[CharacterManager] 添加后 teachers:', this.teachers);
        return newChar;
    }

    // 更新自定义角色
    updateCharacter(id: string, updates: Partial<CharacterConfig>): CharacterConfig | undefined {
        const character = this.getCharacter(id);
        if (character) {
            Object.assign(character, updates, { isCustom: true });
            // 更新自定义角色列表
            const customIndex = this.customCharacters.findIndex(c => c.id === id);
            if (customIndex !== -1) {
                this.customCharacters[customIndex] = character;
            } else {
                this.customCharacters.push(character);
            }
            return character;
        }
        return undefined;
    }

    // 删除角色
    removeCharacter(id: string): boolean {
        const teacherIndex = this.teachers.findIndex(t => t.id === id);
        if (teacherIndex !== -1) {
            this.teachers.splice(teacherIndex, 1);
            // 从自定义角色中也移除
            const customIndex = this.customCharacters.findIndex(c => c.id === id);
            if (customIndex !== -1) {
                this.customCharacters.splice(customIndex, 1);
            }
            return true;
        }
        
        const studentIndex = this.students.findIndex(s => s.id === id);
        if (studentIndex !== -1) {
            this.students.splice(studentIndex, 1);
            const customIndex = this.customCharacters.findIndex(c => c.id === id);
            if (customIndex !== -1) {
                this.customCharacters.splice(customIndex, 1);
            }
            return true;
        }
        
        return false;
    }

    // 获取自定义角色列表（用于保存）
    getCustomCharacters(): CharacterConfig[] {
        return this.customCharacters;
    }

    // 导出角色配置
    exportCharacters(): { teachers: CharacterConfig[]; students: CharacterConfig[] } {
        return {
            teachers: this.teachers,
            students: this.students
        };
    }

    // 导入角色配置
    importCharacters(data: { teachers: CharacterConfig[]; students: CharacterConfig[] }): void {
        if (data.teachers) {
            this.teachers = data.teachers;
        }
        if (data.students) {
            this.students = data.students;
        }
    }
}
