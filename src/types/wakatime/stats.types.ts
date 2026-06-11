export type StatsResponse = {
    data: StatsData;
};

export type StatsData = {
    id: string;
    username: string;
    user_id: string;
    status: string;
    range: string;
    human_readable_range: string;
    human_readable_total: string;
    human_readable_daily_average: string;
    total_seconds: number;
    daily_average: number;
    days_including_holidays: number;
    days_minus_holidays: number;
    holidays: number;
    percent_calculated: number;
    is_up_to_date: boolean;
    is_already_updating: boolean;
    is_including_today: boolean;
    is_coding_activity_visible: boolean;
    is_other_usage_visible: boolean;
    is_stuck: boolean;
    timeout: number;
    writes_only: boolean;
    languages: GeneralStat[];
    editors: GeneralStat[];
    operating_systems: GeneralStat[];
    categories: GeneralStat[];
    projects: GeneralStat[];
};

export type GeneralStat = {
    name: string;
    total_seconds: number;
    percent: number;
    digital: string;
    decimal: string;
    text: string;
    hours: number;
    minutes: number;
};

export type CurrentUserResponse = {
    data: {
        id: string;
        username: string;
        email: string;
        full_name: string;
        display_name: string;
        website: string;
        location: string;
        timezone: string;
        photo: string;
        photo_public: boolean;
        logged_time_public: boolean;
        has_bookmarks: boolean;
        modified_at: string;
    };
};
