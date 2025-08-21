import { eq } from "drizzle-orm";
import type { User } from "@/api/user/userModel";
import { db, users } from "@/db/index";

export class UserRepository {
	async findAllAsync(): Promise<User[]> {
		const result = await db
			.select({
				id: users.id,
				username: users.username,
				createdAt: users.createdAt,
				updatedAt: users.updatedAt,
			})
			.from(users);
		return result;
	}

	async findByUsernameAsync(username: string): Promise<User | null> {
		const result = await db
			.select({
				id: users.id,
				username: users.username,
				createdAt: users.createdAt,
				updatedAt: users.updatedAt,
			})
			.from(users)
			.where(eq(users.username, username));
		return result[0] || null;
	}
}
