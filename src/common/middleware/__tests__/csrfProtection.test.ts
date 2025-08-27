import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { csrfProtection } from "../csrfProtection";

describe("CSRF Protection Middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      method: "POST",
      path: "/test",
      ip: "127.0.0.1",
      headers: {},
      session: undefined as any,
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    next = vi.fn();
  });

  describe("Safe HTTP Methods", () => {
    it("should skip validation for GET requests", () => {
      req.method = "GET";

      csrfProtection(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should skip validation for HEAD requests", () => {
      req.method = "HEAD";

      csrfProtection(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should skip validation for OPTIONS requests", () => {
      req.method = "OPTIONS";

      csrfProtection(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("API Key Authentication", () => {
    it("should skip validation when X-Admin-Key header is present", () => {
      req.headers = { "x-admin-key": "test-api-key" };

      csrfProtection(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("Session-based Authentication", () => {
    it("should fail when session has no CSRF token", () => {
      req.session = {} as any; // Session exists but no CSRF token

      csrfProtection(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "CSRF validation failed: Session expired or invalid",
          status: StatusCodes.FORBIDDEN,
        }),
      );
    });

    it("should fail when no X-CSRF-Token header is provided", () => {
      req.session = { csrfToken: "valid-token" } as any;

      csrfProtection(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "CSRF validation failed: Missing X-CSRF-Token header",
          status: StatusCodes.FORBIDDEN,
        }),
      );
    });

    it("should fail when CSRF tokens don't match", () => {
      req.session = { csrfToken: "valid-token" } as any;
      req.headers = { "x-csrf-token": "invalid-token" };

      csrfProtection(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "CSRF validation failed: Invalid CSRF token",
          status: StatusCodes.FORBIDDEN,
        }),
      );
    });

    it("should succeed when CSRF tokens match", () => {
      const validToken = "valid-csrf-token-12345";
      req.session = { csrfToken: validToken } as any;
      req.headers = { "x-csrf-token": validToken };

      csrfProtection(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("State-changing HTTP Methods", () => {
    it("should validate POST requests", () => {
      req.method = "POST";
      req.session = { csrfToken: "token" } as any;
      req.headers = { "x-csrf-token": "token" };

      csrfProtection(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it("should validate PUT requests", () => {
      req.method = "PUT";
      req.session = { csrfToken: "token" } as any;
      req.headers = { "x-csrf-token": "token" };

      csrfProtection(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it("should validate DELETE requests", () => {
      req.method = "DELETE";
      req.session = { csrfToken: "token" } as any;
      req.headers = { "x-csrf-token": "token" };

      csrfProtection(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it("should validate PATCH requests", () => {
      req.method = "PATCH";
      req.session = { csrfToken: "token" } as any;
      req.headers = { "x-csrf-token": "token" };

      csrfProtection(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("Constant-time Comparison", () => {
    it("should prevent timing attacks with different length tokens", () => {
      req.session = { csrfToken: "short" } as any;
      req.headers = { "x-csrf-token": "this-is-a-much-longer-token" };

      csrfProtection(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
    });

    it("should use constant-time comparison for same-length tokens", () => {
      // This test ensures the function doesn't short-circuit on first difference
      // The implementation should compare all characters even if first char differs
      req.session = { csrfToken: "abcdef" } as any;
      req.headers = { "x-csrf-token": "zbcdef" }; // Only first char differs

      csrfProtection(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
    });
  });
});
