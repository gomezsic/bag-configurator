import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import EngineDemo from "./pages/EngineDemo.tsx";
import NotFound from "./pages/NotFound.tsx";
import { AdminLayout } from "./components/admin/AdminLayout.tsx";
import AdminDashboard from "./pages/admin/AdminDashboard.tsx";
import AdminModels from "./pages/admin/AdminModels.tsx";
import AdminFabrics from "./pages/admin/AdminFabrics.tsx";
import AdminHandleEditor from "./pages/admin/AdminHandleEditor.tsx";
import AdminHandleEditorIndex from "./pages/admin/AdminHandleEditorIndex.tsx";
import AdminHandleStyles from "./pages/admin/AdminHandleStyles.tsx";
import {
  HandlePresetsRedirect,
  HandleTexturesRedirect,
  HandlesRedirect,
} from "./pages/admin/HandleStylesRedirect.tsx";
import AdminTextureLab from "./pages/admin/AdminTextureLab.tsx";
import AdminUpload from "./pages/admin/AdminUpload.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/engine-demo" element={<EngineDemo />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="models" element={<AdminModels />} />
            <Route path="fabrics" element={<AdminFabrics />} />
            <Route path="handles" element={<HandlesRedirect />} />
            <Route path="handle-styles" element={<AdminHandleStyles />} />
            <Route path="handle-presets" element={<HandlePresetsRedirect />} />
            <Route path="handle-textures" element={<HandleTexturesRedirect />} />
            <Route path="handle-editor" element={<AdminHandleEditorIndex />} />
            <Route path="handle-editor/:viewId" element={<AdminHandleEditor />} />
            <Route path="texture-lab" element={<AdminTextureLab />} />
            <Route path="upload" element={<AdminUpload />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
