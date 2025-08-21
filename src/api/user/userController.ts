import type { Request, RequestHandler, Response } from "express";

import { userService } from "@/api/user/userService";

class UserController {
	public getUsers: RequestHandler = async (_req: Request, res: Response) => {
		const serviceResponse = await userService.findAll();
		res.status(serviceResponse.statusCode).send(serviceResponse);
	};

	public getUserByUsername: RequestHandler = async (req: Request, res: Response) => {
		const username = req.params.username as string;
		const serviceResponse = await userService.findByUsername(username);
		res.status(serviceResponse.statusCode).send(serviceResponse);
	};
}

export const userController = new UserController();
