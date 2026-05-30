// Central place for plan limits.
// Free users can have up to this many TOTAL (non-deleted) tasks — completing
// a task does NOT free up a slot. Deleting one does.
export const FREE_TASK_LIMIT = 15;

export const isPremium = (user) => user?.plan === "premium";
