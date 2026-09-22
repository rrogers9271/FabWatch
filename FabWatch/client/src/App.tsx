import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Sidebar from "@/components/Sidebar";
import DashboardPage from "@/pages/Dashboard";
import ListingsPage from "@/pages/Listings";
import MapPage from "@/pages/Map";
import AlertsPage from "@/pages/Alerts";
import ExpansionsPage from "@/pages/Expansions";
import EquipmentPage from "@/pages/Equipment";
import LoginPage from "@/pages/Login";
import PricingPage from "@/pages/Pricing";
import NotFound from "@/pages/not-found";

function AppLayout() {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="main-content" data-testid="main-content">
        <Router hook={useHashLocation}>
          <Switch>
            <Route path="/" component={DashboardPage} />
            <Route path="/listings" component={ListingsPage} />
            <Route path="/map" component={MapPage} />
            <Route path="/alerts" component={AlertsPage} />
            <Route path="/expansions" component={ExpansionsPage} />
            <Route path="/equipment" component={EquipmentPage} />
            <Route path="/pricing" component={PricingPage} />
            <Route component={NotFound} />
          </Switch>
        </Router>
      </main>
      <Toaster />
    </div>
  );
}

function RootRouter() {
  const [location] = useHashLocation();
  if (location === "/login" || location === "/register") {
    return (
      <Router hook={useHashLocation}>
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route path="/register" component={LoginPage} />
        </Switch>
      </Router>
    );
  }
  return <AppLayout />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootRouter />
      <Toaster />
    </QueryClientProvider>
  );
}
