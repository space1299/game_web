import { createBrowserRouter, Navigate } from "react-router-dom";

import { App } from "../App";
import { HomePage } from "../pages/home/HomePage";
import { StatisticsPage } from "../pages/statistics/StatisticsPage";
import { UserReportPage } from "../pages/user-report/UserReportPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "eternal-return/statistics",
        element: <StatisticsPage />,
      },
      {
        path: "eternal-return/user-report",
        element: <UserReportPage />,
      },
      {
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
