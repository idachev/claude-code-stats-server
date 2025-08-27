import { and, eq, sql } from "drizzle-orm";
import { db, tags, users } from "@/db/index";
import type { NewTag } from "@/db/schema";
import { TAG_MAX_LENGTH, TAG_MIN_LENGTH, TAG_NAME_PATTERN } from "./tagSchemas";

export class TagService {
  /**
   * Get all unique tag names in the system (case-insensitive)
   */
  async getTags(): Promise<string[]> {
    // Use raw SQL to get unique tags case-insensitively
    // We'll return the first occurrence of each tag (preserving original casing)
    const result = await db
      .select({
        name: sql<string>`MIN(${tags.name})`.as('name'),
        lowerName: sql<string>`LOWER(${tags.name})`.as('lowerName'),
      })
      .from(tags)
      .groupBy(sql`LOWER(${tags.name})`)
      .orderBy(sql`LOWER(${tags.name})`);

    return result.map((row) => row.name);
  }

  /**
   * Set user tags - replaces all existing tags with new ones
   */
  async setUserTags(userId: number, tagNames: string[]): Promise<void> {
    // Validate tag names
    for (const tagName of tagNames) {
      this.validateTagName(tagName);
    }

    // Remove duplicates and normalize
    const uniqueTags = [...new Set(tagNames.map((name) => name.trim()))];

    await db.transaction(async (tx) => {
      // Delete existing tags for user
      await tx.delete(tags).where(eq(tags.userId, userId));

      // Insert new tags if any
      if (uniqueTags.length > 0) {
        const newTags: NewTag[] = uniqueTags.map((name) => ({
          userId,
          name,
        }));

        await tx.insert(tags).values(newTags);
      }
    });
  }

  /**
   * Get tag names for a specific user
   */
  async getUserTags(userId: number): Promise<string[]> {
    const result = await db
      .select({
        name: tags.name,
      })
      .from(tags)
      .where(eq(tags.userId, userId))
      .orderBy(tags.name);

    return result.map((row) => row.name);
  }

  /**
   * Remove a specific tag from a user
   */
  async removeTagFromUser(userId: number, tagName: string): Promise<void> {
    await db.delete(tags).where(and(eq(tags.userId, userId), sql`LOWER(${tags.name}) = LOWER(${tagName})`));
  }

  /**
   * Get all users that have a specific tag
   */
  async getUsersByTag(tagName: string): Promise<Array<{ id: number; username: string }>> {
    const result = await db
      .select({
        id: users.id,
        username: users.username,
      })
      .from(users)
      .innerJoin(tags, and(eq(tags.userId, users.id), sql`LOWER(${tags.name}) = LOWER(${tagName})`))
      .orderBy(users.username);

    return result;
  }

  /**
   * Get users by multiple tags (users must have ALL specified tags)
   */
  async getUsersByTags(tagNames: string[]): Promise<number[]> {
    if (tagNames.length === 0) {
      return [];
    }

    // Build a query that finds users having ALL specified tags
    const normalizedTags = tagNames.map((tag) => tag.toLowerCase());

    const result = await db
      .select({
        userId: tags.userId,
      })
      .from(tags)
      .where(
        sql`LOWER(${tags.name}) IN (${sql.join(
          normalizedTags.map((tag) => sql`${tag}`),
          sql`, `,
        )})`,
      )
      .groupBy(tags.userId)
      .having(sql`COUNT(DISTINCT LOWER(${tags.name})) = ${normalizedTags.length}`);

    return result.map((row) => row.userId);
  }

  /**
   * Validate tag name format
   */
  private validateTagName(name: string): void {
    const trimmed = name.trim();

    if (trimmed.length < TAG_MIN_LENGTH) {
      throw new Error(`Tag name must be at least ${TAG_MIN_LENGTH} characters`);
    }

    if (trimmed.length > TAG_MAX_LENGTH) {
      throw new Error(`Tag name cannot exceed ${TAG_MAX_LENGTH} characters`);
    }

    if (!TAG_NAME_PATTERN.test(trimmed)) {
      throw new Error("Tag name can only contain letters, numbers, spaces, dots, hyphens, and underscores");
    }
  }
}
