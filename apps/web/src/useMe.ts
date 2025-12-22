import { useEffect, useState } from "react";
import { apiGet } from "./api";

export function useMe() {
    const [me, setMe] = useState<{ id: string } | null>(null);

    useEffect(() => {
        apiGet<{ id: string }>("/auth/me")
            .then(setMe)
            .catch(() => setMe(null));
    }, []);

    return me;
}
