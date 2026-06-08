import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { AuthGate } from "./AuthGate";
import { ErrorBoundary } from "./ErrorBoundary";
import { CaptainPage } from "./pages/CaptainPage";
import { CaptainMP } from "./pages/captain-mp/CaptainMP";
import { InventoryCountPage } from "./pages/captain-mp/InventoryCountPage";
import { InventoryHistoryPage } from "./pages/captain-mp/InventoryHistoryPage";
import { OrdersListPage } from "./pages/captain-mp/OrdersListPage";
import { OrderDetailPage } from "./pages/captain-mp/OrderDetailPage";
import { OrderEditPage } from "./pages/captain-mp/OrderEditPage";
import { ManagerPage } from "./pages/ManagerPage";
import { ManagerInventoryPage } from "./pages/manager/ManagerInventoryPage";
import { ManagerSuggestionReviewPage } from "./pages/manager/ManagerSuggestionReviewPage";
import { DebugPage } from "./pages/DebugPage";
import { BASE_URL } from "./apiClient";
import { LangProvider } from "./i18n";

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">404 — Not found</h1>
      <p className="mt-2 text-sm text-slate-600">
        Backend: <code className="font-mono text-xs">{BASE_URL}</code>
      </p>
      <nav className="mt-6 flex gap-4 text-sm">
        <Link className="text-blue-700 underline" to="/captain">
          Captain
        </Link>
        <Link className="text-blue-700 underline" to="/manager">
          Manager
        </Link>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LangProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/captain-v2" replace />} />
          <Route
            path="/captain"
            element={
              <AuthGate role="captain">
                <CaptainPage />
              </AuthGate>
            }
          />
          <Route
            path="/captain-v2"
            element={
              <AuthGate role="captain">
                <CaptainMP />
              </AuthGate>
            }
          />
          <Route
            path="/captain-v2/inventory-count"
            element={
              <AuthGate role="captain">
                <InventoryCountPage />
              </AuthGate>
            }
          />
          <Route
            path="/captain-v2/inventory-history"
            element={
              <AuthGate role="captain">
                <InventoryHistoryPage />
              </AuthGate>
            }
          />
          <Route
            path="/captain-v2/orders"
            element={
              <AuthGate role="captain">
                <OrdersListPage />
              </AuthGate>
            }
          />
          <Route
            path="/captain-v2/orders/:order_id"
            element={
              <AuthGate role="captain">
                <OrderDetailPage />
              </AuthGate>
            }
          />
          <Route
            path="/captain-v2/orders/:order_id/edit"
            element={
              <AuthGate role="captain">
                <OrderEditPage />
              </AuthGate>
            }
          />
          <Route
            path="/manager"
            element={
              <AuthGate role="manager">
                <ManagerPage />
              </AuthGate>
            }
          />
          <Route
            path="/manager/inventory"
            element={
              <AuthGate role="manager">
                <ManagerInventoryPage />
              </AuthGate>
            }
          />
          <Route
            path="/manager/suggestion-review"
            element={
              <AuthGate role="manager">
                <ManagerSuggestionReviewPage />
              </AuthGate>
            }
          />
          <Route path="/debug" element={<DebugPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </BrowserRouter>
      </LangProvider>
    </ErrorBoundary>
  );
}
