export interface ApiResponse<T> {
    code: number;
    message: string;
    data: T;
}

export interface PageQuery {
    page?: number;
    pageSize?: number;
}

export interface PageResult<T> {
    total: number;
    list: T[];
}
