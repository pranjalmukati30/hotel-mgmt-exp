const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(`Cannot reach the backend at ${API_BASE_URL}. Make sure FastAPI is running.`);
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = body.detail || body.message || message;
      if (Array.isArray(message)) message = message.map((item) => item.msg).join(", ");
    } catch {
      // Keep generic response message if the server did not return JSON.
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

const json = (method, data) => ({ method, body: JSON.stringify(data) });

export const api = { baseUrl: API_BASE_URL };
export const fetchDashboard = () => request("/dashboard");
export const fetchRooms = (params = {}) => {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  const suffix = query.toString();
  return request(`/rooms${suffix ? `?${suffix}` : ""}`);
};
export const fetchGuests = (params = {}) => {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  const suffix = query.toString();
  return request(`/guests${suffix ? `?${suffix}` : ""}`);
};
export const fetchReservations = (params = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  const suffix = query.toString();
  return request(`/reservations${suffix ? `?${suffix}` : ""}`);
};
export const createRoom = (data) => request("/rooms", json("POST", data));
export const updateRoom = (id, data) => request(`/rooms/${id}`, json("PATCH", data));
export const deleteRoom = (id) => request(`/rooms/${id}`, { method: "DELETE" });
export const createGuest = (data) => request("/guests", json("POST", data));
export const updateGuest = (id, data) => request(`/guests/${id}`, json("PATCH", data));
export const deleteGuest = (id) => request(`/guests/${id}`, { method: "DELETE" });
export const createReservation = (data) => request("/reservations", json("POST", data));
export const cancelReservation = (id) => request(`/reservations/${id}/cancel`, { method: "PATCH" });
