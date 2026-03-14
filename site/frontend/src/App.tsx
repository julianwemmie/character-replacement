import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout";
import { RequireAuth } from "@/components/require-auth";
import { HomePage } from "@/pages/home";
import { LoginPage } from "@/pages/login";
import { DashboardPage } from "@/pages/dashboard";
import { JobStatusPage } from "@/pages/job-status";
import { VideoViewerPage } from "@/pages/video-viewer";
import { ExplorePage } from "@/pages/explore";
import { NotFoundPage } from "@/pages/not-found";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route path="/jobs/:id" element={<JobStatusPage />} />
        <Route path="/videos/:id" element={<VideoViewerPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
