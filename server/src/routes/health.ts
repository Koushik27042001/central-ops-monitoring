import { Router } from "express";
import type { ReadinessResponse } from "@centralops/shared";
import { databaseState } from "../config/database.js";

export const healthRouter = Router();

// Public diagnostic summary: no credentials, account information, or connection URLs.
healthRouter.get("/", (_request, response) => {
  const mongodb = databaseState();
  const ready = mongodb === "connected";
  const httpStatus = ready ? 200 : 503;
  const databaseFeature = (name: string) => ({
    name,
    status: ready ? "DEPENDENCY_READY" : "UNAVAILABLE",
    httpStatus,
    check: "MongoDB connection state; individual feature workflow is not tested",
  });
  const backgroundFeature = (name: string) => ({
    name,
    status: ready ? "NOT_VERIFIED" : "UNAVAILABLE",
    httpStatus: ready ? null : 503,
    check: ready ? "Requires the background worker; API readiness does not verify worker execution" : "MongoDB is unavailable",
  });
  const body = {
    service: "OrbitOps API",
    status: ready ? "READY" : "NOT_READY",
    httpStatus,
    timestamp: new Date().toISOString(),
    checks: {
      api: {status: "UP", httpStatus: 200, check: "This API process responded"},
      mongodb: {status: ready ? "CONNECTED" : mongodb.toUpperCase(), httpStatus, check: "Driver connection state; not a live database ping"},
    },
    features: {
      authentication: databaseFeature("Administrator login and sessions"),
      clients: databaseFeature("Client management"),
      websites: databaseFeature("Website management"),
      apiConfiguration: databaseFeature("API monitoring configuration"),
      incidents: databaseFeature("Incident records and in-app notifications"),
      cms: databaseFeature("Blog drafts and content management"),
      analytics: databaseFeature("Stored monitoring history and analytics"),
      demoEnquiries: databaseFeature("Demo enquiry submissions"),
      monitoring: backgroundFeature("Scheduled uptime and API checks"),
      publishing: backgroundFeature("Scheduled remote publishing"),
    },
    endpoints: {
      summary: "/api/health",
      versionedSummary: "/api/v1/health/status",
      liveness: "/api/v1/health/live",
      readiness: "/api/v1/health/ready",
    },
    statusCodeReference: {
      "200": "OK: request succeeded or readiness requirements passed",
      "201": "Created: a record was created",
      "202": "Accepted: a check or publishing request was scheduled for background processing",
      "204": "No Content: success without a response body",
      "400": "Bad Request: invalid input or malformed JSON",
      "401": "Unauthorized: login is required or credentials are invalid",
      "403": "Forbidden: request origin or access is not allowed",
      "404": "Not Found: endpoint or record does not exist",
      "405": "Method Not Allowed: this endpoint does not support that HTTP method",
      "409": "Conflict: duplicate record or conflicting operation",
      "413": "Payload Too Large: request exceeds the API body limit",
      "422": "Unprocessable Content: related website or client is invalid",
      "429": "Too Many Requests: rate limit reached",
      "500": "Internal Server Error: unexpected server failure",
      "502": "Bad Gateway: hosting proxy could not obtain a valid backend response",
      "503": "Service Unavailable: a required dependency is unavailable",
      "504": "Gateway Timeout: hosting proxy timed out waiting for the backend",
    },
    note: "Feature entries describe dependency readiness, not end-to-end feature tests. NOT_VERIFIED and null mean no live result was measured. The status-code reference lists possible responses, not simultaneous health results. If the API process is offline, it cannot return this document.",
  };
  response.status(httpStatus).type("application/json").send(JSON.stringify(body, null, 2));
});

healthRouter.get("/live", (_request, response) => {
  response.status(200).json({ status: "alive" });
});

healthRouter.get("/ready", (_request, response) => {
  const mongodb = databaseState();
  const body: ReadinessResponse = {
    status: mongodb === "connected" ? "ready" : "not_ready",
    dependencies: { mongodb },
  };
  response.status(body.status === "ready" ? 200 : 503).json(body);
});
