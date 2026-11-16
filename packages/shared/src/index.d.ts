export type DependencyState = "connected" | "disconnected" | "not_configured";

export interface ReadinessResponse {
  status: "ready" | "not_ready";
  dependencies: {
    mongodb: DependencyState;
  };
}
