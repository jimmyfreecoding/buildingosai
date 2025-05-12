import { EventEmitter } from 'events';

// 创建事件总线
const eventBus = new EventEmitter();

// 设置最大监听器数量，避免内存泄漏警告
eventBus.setMaxListeners(20);

// 导出事件总线
export default eventBus;

