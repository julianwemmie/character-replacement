import { Router } from "express";
import type { ApiResponse, Job } from "@character-replacement/shared";

export const jobRoutes = Router();

jobRoutes.post("/", (_req, res) => {
  const response: ApiResponse<Job> = {
    success: false,
    error: "Not implemented",
  };
  res.status(501).json(response);
});

jobRoutes.get("/:id", (req, res) => {
  const response: ApiResponse<Job> = {
    success: false,
    error: `Job ${req.params.id} not found`,
  };
  res.status(404).json(response);
});
