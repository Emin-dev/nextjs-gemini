export const LOCAL_STORAGE_KEY = 'nextjs-todo-app-todos';

// Durations
export const INACTIVITY_TIMEOUT = 3000; // 3 seconds for inactivity to focus input
export const UNDO_TIMEOUT = 20000; // 20 seconds for Stage 1 Undo
export const STATUS_MESSAGE_DURATION = 3000; // 3 seconds for general status messages
export const STAGE_2_GRACE_PERIOD_DURATION = 60000; // 1 minute for Stage 2 individual restore
export const STAGE_4_GLOBAL_RESTORE_WINDOW = 5 * 60 * 1000; // 5 minutes for Stage 4 global restore window
export const AUTO_FINAL_DELETE_INTERVAL = 5000; // Check every 5 seconds for Stage 3 auto-deletion
export const CURRENT_TIME_UPDATE_INTERVAL = 1000; // Update current time every second for countdowns
