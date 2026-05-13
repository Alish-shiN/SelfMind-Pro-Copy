import { apiFetch } from "./client";

export type GoalType = "reflection" | "mood_tracking" | "self_care" | "custom";
export type GoalPeriod = "daily" | "weekly";

export type Goal = {
  id: number;
  title: string;
  description: string | null;
  goal_type: GoalType;
  target_count: number;
  period: GoalPeriod;
  template_key: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type GoalTemplate = {
  key: string;
  title: string;
  description: string;
  goal_type: GoalType;
  target_count: number;
  period: GoalPeriod;
};

export type GoalProgress = {
  goal: Goal;
  current_count: number;
  target_count: number;
  progress_percentage: number;
  is_completed: boolean;
  period_start: string;
  period_end: string;
  message: string;
};

export type WeeklyGoalSummary = {
  period_start: string;
  period_end: string;
  active_goals: number;
  completed_goals: number;
  partially_completed_goals: number;
  missed_goals: number;
  overall_completion_percentage: number;
  supportive_message: string;
  goals: GoalProgress[];
};

export type GoalCreate = {
  title: string;
  description?: string | null;
  goal_type: GoalType;
  target_count: number;
  period: GoalPeriod;
  template_key?: string | null;
};

export type GoalUpdate = Partial<
  Pick<Goal, "title" | "description" | "target_count" | "period" | "is_active">
>;

export function getGoalTemplates() {
  return apiFetch<GoalTemplate[]>("/goals/templates", { auth: true });
}

export function getGoals(includeInactive = false) {
  return apiFetch<Goal[]>(
    `/goals?include_inactive=${includeInactive ? "true" : "false"}`,
    { auth: true },
  );
}

export function createGoal(payload: GoalCreate) {
  return apiFetch<Goal>("/goals", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export function updateGoal(goalId: number, payload: GoalUpdate) {
  return apiFetch<Goal>(`/goals/${goalId}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(payload),
  });
}

export function deleteGoal(goalId: number) {
  return apiFetch<void>(`/goals/${goalId}`, { method: "DELETE", auth: true });
}

export function getGoalProgress() {
  return apiFetch<GoalProgress[]>("/goals/progress", { auth: true });
}

export function getWeeklyGoalSummary() {
  return apiFetch<WeeklyGoalSummary>("/goals/weekly-summary", { auth: true });
}

export function completeGoal(goalId: number) {
  return apiFetch<GoalProgress>(`/goals/${goalId}/complete`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({}),
  });
}
