import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { LoadingProvider } from "./contexts/LoadingContext";
import Index from "./pages/Index";
import Books from "./pages/Books";
import BookDetail from "./pages/BookDetail";
import BookReview from "./pages/BookReview";
import PopularReviews from "./pages/PopularReviews";
import AddBook from "./pages/AddBook";
import MyPage from "./pages/MyPage";
import ReturnProof from "./pages/ReturnProof";
import RentalRestriction from "./pages/RentalRestriction";
import RewardNotification from "./pages/RewardNotification";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LoadingProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/books" element={<Books />} />
            <Route path="/books/:id" element={<BookDetail />} />
            <Route path="/books/:bookId/review" element={<BookReview />} />
            <Route path="/reviews" element={<PopularReviews />} />
            <Route path="/add-book" element={<AddBook />} />
            <Route path="/my" element={<MyPage />} />
            <Route path="/return-proof/:transactionId" element={<ReturnProof />} />
            <Route path="/rental-restriction" element={<RentalRestriction />} />
            <Route path="/rewards" element={<RewardNotification />} />
            <Route path="/auth" element={<Auth />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </TooltipProvider>
      </LoadingProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
