import { StatusCodes } from "http-status-codes";
import pino from "pino";

import type { User } from "@/api/user/userModel";
import { type UserListFilters, type UserListResult, UserRepository } from "@/api/user/userRepository";
import { ServiceResponse } from "@/common/models/serviceResponse";

const logger = pino({ name: "UserService" });

export class UserService {
  private userRepository: UserRepository;

  constructor(repository: UserRepository = new UserRepository()) {
    this.userRepository = repository;
  }

  // Retrieves all users from the database with optional filters and pagination
  async findAll(filters?: UserListFilters): Promise<ServiceResponse<UserListResult | null>> {
    try {
      const result = await this.userRepository.findAllAsync(filters);
      if (!result.users || result.users.length === 0) {
        // Return empty result with pagination metadata
        return ServiceResponse.success<UserListResult>("No users found", {
          users: [],
          pagination: result.pagination,
          filters: result.filters,
        });
      }
      return ServiceResponse.success<UserListResult>("Users found", result);
    } catch (ex) {
      const errorMessage = `Error finding all users: $${(ex as Error).message}`;
      logger.error(errorMessage);
      return ServiceResponse.failure(
        "An error occurred while retrieving users.",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Legacy method for backward compatibility - retrieves all users without pagination
  async findAllSimple(): Promise<ServiceResponse<User[] | null>> {
    try {
      const users = await this.userRepository.findAllSimpleAsync();
      if (!users || users.length === 0) {
        return ServiceResponse.success<User[]>("No users found", []);
      }
      return ServiceResponse.success<User[]>("Users found", users);
    } catch (ex) {
      const errorMessage = `Error finding all users: $${(ex as Error).message}`;
      logger.error(errorMessage);
      return ServiceResponse.failure(
        "An error occurred while retrieving users.",
        null,
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Retrieves a single user by their username
  async findByUsername(username: string): Promise<ServiceResponse<User | null>> {
    try {
      const user = await this.userRepository.findByUsernameAsync(username);
      if (!user) {
        return ServiceResponse.failure("User not found", null, StatusCodes.NOT_FOUND);
      }
      return ServiceResponse.success<User>("User found", user);
    } catch (ex) {
      const errorMessage = `Error finding user with username ${username}: ${(ex as Error).message}`;
      logger.error(errorMessage);
      return ServiceResponse.failure("An error occurred while finding user.", null, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }
}

export const userService = new UserService();
