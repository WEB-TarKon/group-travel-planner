import "leaflet/dist/leaflet.css";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import TripsPage from "./pages/TripsPage";
import TripPage from "./pages/TripPage";

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<TripsPage />} />
                <Route path="/trips/:id" element={<TripPage />} />
            </Routes>
        </BrowserRouter>
    );
}
