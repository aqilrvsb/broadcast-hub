import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import Devices from "./pages/Devices";
import AddLeads from "./pages/AddLeads";
import Sequences from "./pages/Sequences";
import SequencesSummary from "./pages/SequencesSummary";
import Transaction from "./pages/Transaction";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<Navigate to="/devices" replace />} />
          <Route path="/devices" element={<Layout><Devices /></Layout>} />
          <Route path="/add-leads" element={<Layout><AddLeads /></Layout>} />
          <Route path="/sequences" element={<Layout><Sequences /></Layout>} />
          <Route path="/sequences-summary" element={<Layout><SequencesSummary /></Layout>} />
          <Route path="/transaction" element={<Layout><Transaction /></Layout>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
