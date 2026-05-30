// Central place for plan limits so the rule lives in one spot.
// Free users can have up to this many ACTIVE (incomplete) tasks.
export const FREE_ACTIVE_TASK_LIMIT = 15;

export const isPremium = (user) => user?.plan === "premium";
