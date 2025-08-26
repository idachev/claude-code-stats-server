import { and, asc, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import type { User } from "@/api/user/userModel";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "@/common/schemas/validationSchemas";
import { db, tags, users } from "@/db/index";

export interface UserListFilters {
	search?: string;
	tags?: string[];
	page?: number;
	limit?: number;
	sortBy?: "username" | "createdAt" | "updatedAt";
	order?: "asc" | "desc";
}

export interface UserListResult {
	users: User[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
	filters: {
		search?: string;
		tags?: string[];
	};
}

export class UserRepository {
	async findAllAsync(filters?: UserListFilters): Promise<UserListResult> {
		// Default pagination values
		const page = filters?.page || 1;
		const limit = Math.min(filters?.limit || DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
		const offset = (page - 1) * limit;
		const sortBy = filters?.sortBy || "createdAt";
		const order = filters?.order || "desc";

		// Build where conditions
		const whereConditions = [];

		// Search by username (partial match)
		if (filters?.search) {
			whereConditions.push(ilike(users.username, `%${filters.search}%`));
		}

		// Filter by tags - get user IDs that have the specified tags
		let userIdsWithTags: number[] | null = null;
		if (filters?.tags && filters.tags.length > 0) {
			const usersWithTags = await db
				.select({ userId: tags.userId })
				.from(tags)
				.where(inArray(tags.name, filters.tags))
				.groupBy(tags.userId)
				.having(sql`count(distinct ${tags.name}) = ${filters.tags.length}`);

			userIdsWithTags = usersWithTags.map((row) => row.userId);

			// If no users have all the specified tags, return empty result
			if (userIdsWithTags.length === 0) {
				return {
					users: [],
					pagination: {
						page,
						limit,
						total: 0,
						totalPages: 0,
					},
					filters: {
						search: filters.search,
						tags: filters.tags,
					},
				};
			}

			whereConditions.push(inArray(users.id, userIdsWithTags));
		}

		// Build the where clause
		const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

		// Get total count for pagination
		const countResult = await db
			.select({ count: sql<number>`cast(count(distinct ${users.id}) as integer)` })
			.from(users)
			.where(whereClause);

		const total = countResult[0]?.count || 0;
		const totalPages = Math.ceil(total / limit);

		// Query 1: Get paginated users WITHOUT tags
		// Apply all filtering, sorting, and pagination at the database level
		const orderByColumn =
			sortBy === "username" ? users.username : sortBy === "createdAt" ? users.createdAt : users.updatedAt;
		const orderDirection = order === "asc" ? asc : desc;

		const paginatedUsersResult = await db
			.select({
				id: users.id,
				username: users.username,
				createdAt: users.createdAt,
				updatedAt: users.updatedAt,
			})
			.from(users)
			.where(whereClause)
			.orderBy(orderDirection(orderByColumn))
			.limit(limit)
			.offset(offset);

		// If no users found, return early
		if (paginatedUsersResult.length === 0) {
			return {
				users: [],
				pagination: {
					page,
					limit,
					total,
					totalPages,
				},
				filters: {
					search: filters?.search,
					tags: filters?.tags,
				},
			};
		}

		// Query 2: Get tags ONLY for the users in the current page
		const userIds = paginatedUsersResult.map((u) => u.id);
		const tagsResult = await db
			.select({
				userId: tags.userId,
				name: tags.name,
			})
			.from(tags)
			.where(inArray(tags.userId, userIds))
			.orderBy(tags.name);

		// Create a map of userId to tags array
		const userTagsMap = new Map<number, string[]>();
		for (const tag of tagsResult) {
			if (!userTagsMap.has(tag.userId)) {
				userTagsMap.set(tag.userId, []);
			}
			userTagsMap.get(tag.userId)?.push(tag.name);
		}

		// Combine users with their tags
		const usersWithTags: User[] = paginatedUsersResult.map((user) => ({
			id: user.id,
			username: user.username,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
			tags: userTagsMap.get(user.id) || [],
		}));

		return {
			users: usersWithTags,
			pagination: {
				page,
				limit,
				total,
				totalPages,
			},
			filters: {
				search: filters?.search,
				tags: filters?.tags,
			},
		};
	}

	async findAllSimpleAsync(): Promise<User[]> {
		// Keep the simple version for backward compatibility
		const result = await this.findAllAsync();
		return result.users;
	}

	async findByUsernameAsync(username: string): Promise<User | null> {
		const result = await db
			.select({
				id: users.id,
				username: users.username,
				createdAt: users.createdAt,
				updatedAt: users.updatedAt,
				tagName: tags.name,
			})
			.from(users)
			.leftJoin(tags, eq(users.id, tags.userId))
			.where(eq(users.username, username))
			.orderBy(tags.name);

		if (result.length === 0) {
			return null;
		}

		// Collect all tags for the user
		const user: User = {
			id: result[0].id,
			username: result[0].username,
			createdAt: result[0].createdAt,
			updatedAt: result[0].updatedAt,
			tags: result.filter((row) => row.tagName !== null).map((row) => row.tagName as string),
		};

		return user;
	}
}
