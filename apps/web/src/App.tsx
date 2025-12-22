import { BrowserRouter, Route, Routes } from "react-router-dom";
import TripsPage from "./pages/TripsPage";
import TripPage from "./pages/TripPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProtectedRoute from "./ProtectedRoute";

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                <Route path="/" element={<ProtectedRoute><TripsPage /></ProtectedRoute>} />
                <Route path="/trips/:id" element={<ProtectedRoute><TripPage /></ProtectedRoute>} />
            </Routes>
        </BrowserRouter>
    );
}
