import { eq } from "drizzle-orm";
import type { User } from "@/api/user/userModel";
import { db, tags, users } from "@/db/index";

export class UserRepository {
	async findAllAsync(): Promise<User[]> {
		// Get all users with their tags using a single query
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
			.orderBy(users.id, tags.name);

		// Group tags by user
		const userMap = new Map<number, User>();

		for (const row of result) {
			if (!userMap.has(row.id)) {
				userMap.set(row.id, {
					id: row.id,
					username: row.username,
					createdAt: row.createdAt,
					updatedAt: row.updatedAt,
					tags: [],
				});
			}

			const user = userMap.get(row.id);
			if (user && row.tagName) {
				user.tags.push(row.tagName);
			}
		}

		return Array.from(userMap.values());
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
