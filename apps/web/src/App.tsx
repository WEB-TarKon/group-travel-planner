import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";

export default function App() {
    const kyiv: [number, number] = [50.4501, 30.5234];

    return (
        <div style={{ height: "100vh", width: "100vw" }}>
            <MapContainer center={kyiv} zoom={12} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                />
                <Marker position={kyiv}>
                    <Popup>Стартова точка (Київ)</Popup>
                </Marker>
            </MapContainer>
        </div>
    );
}
