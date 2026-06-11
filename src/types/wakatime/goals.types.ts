export type GoalsResponse = {
    data: Goal[];
};

export type Goal = {
    id: string;
    title: string;
    description: string;
    status: string;
    range: GoalRange;
    chart_data: GoalChartData;
    percent_calculated: number;
    percent_completed: number;
    is_current: boolean;
    is_completed: boolean;
    is_enabled: boolean;
    is_recurring: boolean;
    is_snoozed: boolean;
    modified_at: string;
    seconds_completed: number;
    seconds_goal: number;
};

export type GoalRange = {
    end: string;
    end_date: string;
    end_text: string;
    start: string;
    start_date: string;
    start_text: string;
    timezone: string;
};

export type GoalChartData = {
    actual: number;
    goal: number;
    holidays: number;
    range: GoalRange;
};
