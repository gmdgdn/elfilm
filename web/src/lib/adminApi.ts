import { requestAdmin } from "@/actions/admin"

type AdminQueryValue = string | number | boolean | undefined
type AdminJsonRecord = Record<string, unknown>

export interface AdminApiConfig {
    baseUrl: string
}

export interface DashboardStats {
    totalMovies: number
    totalPeople: number
    totalCompanies: number
    totalGenres: number
    totalTags: number
    recentMovies: number
    recentPeople: number
}

export interface MoviesByYearStat {
    year: number
    count: number
}

export interface MoviesByDecadeStat {
    decade: number
    count: number
}

export interface GenreDistributionStat {
    id: number
    name_ar: string
    name_en: string | null
    count: number
}

export interface TopCreditStat {
    id: string
    slug: string
    name_ar: string
    name_en: string | null
    profile_image: string | null
    count: number
}

export interface RecentActivityItem {
    id: string
    title_ar: string
    title_en: string | null
    year: number
    created_at: string
}

export interface AuditLogItem {
    id: number
    user_id: string | null
    action: "create" | "update" | "delete"
    entity_type: string
    entity_id: string
    details: string | null
    created_at: string
}

export interface VectorIndexInfo {
    [key: string]: unknown
}

export interface GenerateEmbeddingsResponse {
    success?: boolean
    message?: string
    processed: number
    errors: number
    offset: number
    nextOffset: number
    afterId?: string | null
    nextAfterId?: string | null
    hasMore: boolean
}

export interface AdminDatabaseColumn {
    name: string
    label: string
    dbType: string
    input: "text" | "textarea" | "integer" | "real" | "boolean" | "date" | "datetime" | "url"
    required: boolean
    nullable: boolean
    primaryKey: boolean
    editableOnCreate: boolean
    editableOnUpdate: boolean
    tableVisible: boolean
    description?: string
}

export interface AdminDatabaseEntity {
    key: string
    label: string
    description: string
    table: string
    primaryKey: string[]
    searchable: string[]
    previewColumns: string[]
    defaultSort: {
        field: string
        direction: "ASC" | "DESC"
    }
    readOnly: boolean
    readOnlyReason?: string
    count?: number
    columns: AdminDatabaseColumn[]
}

export interface AdminDatabaseRowsResponse {
    entity: AdminDatabaseEntity
    rows: Record<string, unknown>[]
    total: number
    limit: number
    offset: number
    search: string
    orderBy: string
    direction: "ASC" | "DESC"
}

export interface AdminSettings {
    maintenanceMode: boolean
    debugMode: boolean
    publicRegistration: boolean
    cacheTtl: number
}

function buildQueryString(params?: Record<string, AdminQueryValue>) {
    if (!params) {
        return ""
    }

    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") {
            query.set(key, String(value))
        }
    }

    return query.toString()
}

class AdminApiClient {
    private config: AdminApiConfig

    constructor(config?: Partial<AdminApiConfig>) {
        this.config = {
            baseUrl: config?.baseUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787',
        }
    }

    private async request<T>(
        endpoint: string,
        options?: RequestInit
    ): Promise<T> {
        return requestAdmin<T>(endpoint, {
            method: options?.method,
            body: options?.body,
        })
    }

    // Stats
    async getStats(): Promise<{ stats: DashboardStats }> {
        return this.request('/api/admin/stats')
    }

    async getMoviesByYearStats(limit = 50): Promise<{ data: MoviesByYearStat[] }> {
        return this.request(`/api/admin/analytics/movies-by-year?limit=${limit}`)
    }

    async getMoviesByDecadeStats(): Promise<{ data: MoviesByDecadeStat[] }> {
        return this.request('/api/admin/analytics/movies-by-decade')
    }

    async getGenreDistribution(): Promise<{ data: GenreDistributionStat[] }> {
        return this.request('/api/admin/analytics/genres')
    }

    async getTopActors(limit = 10): Promise<{ data: TopCreditStat[] }> {
        return this.request(`/api/admin/analytics/top-actors?limit=${limit}`)
    }

    async getTopDirectors(limit = 10): Promise<{ data: TopCreditStat[] }> {
        return this.request(`/api/admin/analytics/top-directors?limit=${limit}`)
    }

    async getRecentActivity(limit = 10): Promise<{ data: RecentActivityItem[] }> {
        return this.request(`/api/admin/analytics/recent-activity?limit=${limit}`)
    }

    // Movies
    async getMovies(params?: {
        limit?: number
        offset?: number
        orderBy?: string
        direction?: string
    }) {
        const query = buildQueryString(params)
        return this.request(`/api/admin/movies${query ? `?${query}` : ''}`)
    }

    async getMovie(id: string) {
        return this.request(`/api/admin/movies/${id}`)
    }

    async createMovie(data: AdminJsonRecord) {
        return this.request('/api/admin/movies', {
            method: 'POST',
            body: JSON.stringify(data),
        })
    }

    async updateMovie(id: string, data: AdminJsonRecord) {
        return this.request(`/api/admin/movies/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        })
    }

    async deleteMovie(id: string) {
        return this.request(`/api/admin/movies/${id}`, {
            method: 'DELETE',
        })
    }

    // People
    async getPeople(params?: {
        limit?: number
        offset?: number
        orderBy?: string
    }) {
        const query = buildQueryString(params)
        return this.request(`/api/admin/people${query ? `?${query}` : ''}`)
    }

    async getPerson(id: string) {
        return this.request(`/api/admin/people/${id}`)
    }

    async createPerson(data: AdminJsonRecord) {
        return this.request('/api/admin/people', {
            method: 'POST',
            body: JSON.stringify(data),
        })
    }

    async updatePerson(id: string, data: AdminJsonRecord) {
        return this.request(`/api/admin/people/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        })
    }

    async deletePerson(id: string) {
        return this.request(`/api/admin/people/${id}`, {
            method: 'DELETE',
        })
    }

    // Companies
    async getCompanies(params?: {
        limit?: number
        offset?: number
        orderBy?: string
    }) {
        const query = buildQueryString(params)
        return this.request(`/api/admin/companies${query ? `?${query}` : ''}`)
    }

    async getCompany(id: string) {
        return this.request(`/api/admin/companies/${id}`)
    }

    async createCompany(data: AdminJsonRecord) {
        return this.request('/api/admin/companies', {
            method: 'POST',
            body: JSON.stringify(data),
        })
    }

    async updateCompany(id: string, data: AdminJsonRecord) {
        return this.request(`/api/admin/companies/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        })
    }

    async deleteCompany(id: string) {
        return this.request(`/api/admin/companies/${id}`, {
            method: 'DELETE',
        })
    }

    // Taxonomy
    async getGenres() {
        return this.request('/api/admin/genres')
    }

    async createGenre(data: { slug: string; name_ar: string; name_en?: string }) {
        return this.request('/api/admin/genres', {
            method: 'POST',
            body: JSON.stringify(data),
        })
    }

    async updateGenre(id: number, data: AdminJsonRecord) {
        return this.request(`/api/admin/genres/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        })
    }

    async deleteGenre(id: number) {
        return this.request(`/api/admin/genres/${id}`, {
            method: 'DELETE',
        })
    }

    async getTags() {
        return this.request('/api/admin/tags')
    }

    async createTag(data: {
        slug: string
        name_ar: string
        name_en?: string
        category?: string
    }) {
        return this.request('/api/admin/tags', {
            method: 'POST',
            body: JSON.stringify(data),
        })
    }

    async updateTag(id: number, data: AdminJsonRecord) {
        return this.request(`/api/admin/tags/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        })
    }

    async deleteTag(id: number) {
        return this.request(`/api/admin/tags/${id}`, {
            method: 'DELETE',
        })
    }

    // Vector Search
    async getVectorStatus(): Promise<{ info: VectorIndexInfo }> {
        return this.request('/api/admin/vectorize/status')
    }

    async generateEmbeddings(limit = 50, afterId?: string | null): Promise<GenerateEmbeddingsResponse> {
        const params = new URLSearchParams({ limit: String(limit) })
        if (afterId) {
            params.set("afterId", afterId)
        }

        return this.request(`/api/admin/vectorize/generate?${params.toString()}`, {
            method: 'POST'
        })
    }

    // Audit Log
    async getAuditLog(params?: {
        limit?: number
        offset?: number
    }): Promise<{ logs: AuditLogItem[]; count: number; limit: number; offset: number }> {
        const query = buildQueryString(params)
        return this.request(`/api/admin/audit-log${query ? `?${query}` : ''}`)
    }

    async getEntityAuditLog(entityType: string, entityId: string, limit = 20): Promise<{ logs: AuditLogItem[] }> {
        return this.request(`/api/admin/audit-log/${entityType}/${entityId}?limit=${limit}`)
    }

    // Database Studio
    async getDatabaseEntities(): Promise<{ entities: AdminDatabaseEntity[] }> {
        return this.request('/api/admin/database/entities')
    }

    async getDatabaseEntity(entity: string): Promise<{ entity: AdminDatabaseEntity }> {
        return this.request(`/api/admin/database/entities/${entity}`)
    }

    async getDatabaseRows(
        entity: string,
        params?: {
            limit?: number
            offset?: number
            search?: string
            orderBy?: string
            direction?: "ASC" | "DESC"
        }
    ): Promise<AdminDatabaseRowsResponse> {
        const query = new URLSearchParams()

        if (params?.limit !== undefined) query.set("limit", String(params.limit))
        if (params?.offset !== undefined) query.set("offset", String(params.offset))
        if (params?.search) query.set("search", params.search)
        if (params?.orderBy) query.set("orderBy", params.orderBy)
        if (params?.direction) query.set("direction", params.direction)

        return this.request(`/api/admin/database/entities/${entity}/rows${query.size ? `?${query.toString()}` : ""}`)
    }

    async createDatabaseRow(entity: string, values: Record<string, unknown>) {
        return this.request(`/api/admin/database/entities/${entity}/rows`, {
            method: "POST",
            body: JSON.stringify({ values }),
        })
    }

    async updateDatabaseRow(entity: string, primaryKey: Record<string, unknown>, values: Record<string, unknown>) {
        return this.request(`/api/admin/database/entities/${entity}/rows`, {
            method: "PATCH",
            body: JSON.stringify({ primaryKey, values }),
        })
    }

    async deleteDatabaseRow(entity: string, primaryKey: Record<string, unknown>) {
        return this.request(`/api/admin/database/entities/${entity}/rows`, {
            method: "DELETE",
            body: JSON.stringify({ primaryKey }),
        })
    }

    // Settings
    async getSettings(): Promise<{ settings: AdminSettings }> {
        return this.request('/api/admin/settings')
    }

    async updateSettings(data: Partial<AdminSettings>): Promise<{ success: boolean; settings: AdminSettings }> {
        return this.request('/api/admin/settings', {
            method: 'PUT',
            body: JSON.stringify(data),
        })
    }
}

// Export singleton instance
export const adminApi = new AdminApiClient()

// Export class for custom instances
export { AdminApiClient }
