import { BrowserRouter, Route, Routes } from "react-router-dom";
import TripsPage from "./pages/TripsPage";
import TripPage from "./pages/TripPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProtectedRoute from "./ProtectedRoute";
import PublicTripsPage from "./pages/PublicTripsPage";
import ProfilePage from "./pages/ProfilePage.tsx";
import NotificationsPage from "./pages/NotificationsPage.tsx";

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                <Route path="/" element={<ProtectedRoute><TripsPage /></ProtectedRoute>} />
                <Route path="/public" element={<ProtectedRoute><PublicTripsPage /></ProtectedRoute>} />
                <Route path="/trips/:id" element={<ProtectedRoute><TripPage /></ProtectedRoute>} />

                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            </Routes>
        </BrowserRouter>
    );
}
