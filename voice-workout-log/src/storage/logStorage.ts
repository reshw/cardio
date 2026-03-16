import type { WorkoutLog, UserProfile, DailyTodo } from '../types';

const STORAGE_KEY = 'vwl_logs';
const PROFILE_KEY = 'vwl_profile';
const TODO_KEY = 'vwl_todos';

export const getAllLogs = (): WorkoutLog[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as WorkoutLog[];
  } catch (error) {
    console.error('Failed to load logs:', error);
    return [];
  }
};

export const saveLog = (log: WorkoutLog): void => {
  try {
    const logs = getAllLogs();
    const existingIndex = logs.findIndex((l) => l.id === log.id);

    if (existingIndex >= 0) {
      logs[existingIndex] = log;
    } else {
      logs.push(log);
    }

    logs.sort((a, b) => b.createdAt - a.createdAt);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch (error) {
    console.error('Failed to save log:', error);
    throw new Error('저장에 실패했습니다.');
  }
};

export const deleteLog = (id: string): void => {
  try {
    const logs = getAllLogs();
    const filtered = logs.filter((l) => l.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete log:', error);
    throw new Error('삭제에 실패했습니다.');
  }
};

export const getLogById = (id: string): WorkoutLog | null => {
  const logs = getAllLogs();
  return logs.find((l) => l.id === id) || null;
};

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

export const formatDate = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// User Profile Management
export const getUserProfile = (): UserProfile | null => {
  try {
    const data = localStorage.getItem(PROFILE_KEY);
    if (!data) return null;
    return JSON.parse(data) as UserProfile;
  } catch (error) {
    console.error('Failed to load profile:', error);
    return null;
  }
};

export const saveUserProfile = (profile: UserProfile): void => {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.error('Failed to save profile:', error);
    throw new Error('프로필 저장에 실패했습니다.');
  }
};

export const deleteUserProfile = (): void => {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch (error) {
    console.error('Failed to delete profile:', error);
    throw new Error('프로필 삭제에 실패했습니다.');
  }
};

// Daily Todo Management
export const getTodayTodo = (): DailyTodo | null => {
  try {
    const today = formatDate();
    const todos = getAllTodos();
    return todos.find((t) => t.date === today) || null;
  } catch (error) {
    console.error('Failed to load today todo:', error);
    return null;
  }
};

export const getAllTodos = (): DailyTodo[] => {
  try {
    const data = localStorage.getItem(TODO_KEY);
    if (!data) return [];
    return JSON.parse(data) as DailyTodo[];
  } catch (error) {
    console.error('Failed to load todos:', error);
    return [];
  }
};

export const saveTodo = (todo: DailyTodo): void => {
  try {
    const todos = getAllTodos();
    const existingIndex = todos.findIndex((t) => t.id === todo.id);

    if (existingIndex >= 0) {
      todos[existingIndex] = todo;
    } else {
      todos.push(todo);
    }

    todos.sort((a, b) => b.createdAt - a.createdAt);
    localStorage.setItem(TODO_KEY, JSON.stringify(todos));
  } catch (error) {
    console.error('Failed to save todo:', error);
    throw new Error('Todo 저장에 실패했습니다.');
  }
};

export const deleteTodo = (id: string): void => {
  try {
    const todos = getAllTodos();
    const filtered = todos.filter((t) => t.id !== id);
    localStorage.setItem(TODO_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete todo:', error);
    throw new Error('Todo 삭제에 실패했습니다.');
  }
};
