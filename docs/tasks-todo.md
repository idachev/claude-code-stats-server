Can you think deeper and make plan to refactor the response format of all endpoints that uses ServiceResponse

1. Let all endpoints return the responseObject directly
2. Fix this in the swagger/openapi definitions too fot the direct response types
3. On error let all endpoints return an ErrorResponse which is with these fields:
 {
    "error": "...",
    "timestamp": "<ISO_8601>",
    "status": "HTTP status code"
  }
4. Fix this in the swagger/openapi definitions too for the ErrorResponse
5. Cleanup ServiceResponse as it should not be used anymore.
6. Fix the testes to assert the changed respone error formats
