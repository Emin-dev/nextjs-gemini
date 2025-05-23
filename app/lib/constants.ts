export const LOCAL_STORAGE_KEY = 'nextjs-todo-app-todos';

// Durations
export const INACTIVITY_TIMEOUT = 3000; // 3 seconds for inactivity to focus input
export const UNDO_TIMEOUT = 20 * 1000; // 20 seconds (for the "red timer" individual undo)
export const STATUS_MESSAGE_DURATION = 3000; // 3 seconds for general status messages
export const FILTER_SWITCH_DELAY = 20 * 1000; // 20 seconds before a deleted item appears in the 'deleted' filter
export const GREEN_BUTTON_RESTORE_WINDOW = 5 * 60 * 1000; // 5 minutes for the "green button" batch restore window
export const AUTO_FINAL_DELETE_INTERVAL = 5000; // Check every 5 seconds for auto-deletion
export const CURRENT_TIME_UPDATE_INTERVAL = 1000; // Update current time every second for countdowns
export const STAGE_2_GRACE_PERIOD_DURATION = 60 * 1000; // 1 minute (was 30 seconds) for individual task final deletion grace period
export const STAGE_4_GLOBAL_RESTORE_WINDOW = 5 * 60 * 1000; // 5 minutes