// Centralized client for the Haven Grand backend (FastAPI).
// Base URL comes from VITE_API_BASE_URL; change it in .env / deployment env only.
export const API_BASE_URL = (
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "https://hotel-mgmt-exp.onrender.com"
).replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function formatDetail(detail: unknown): string | null {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((d: { loc?: unknown[]; msg?: string }) => {
        const field = d.loc?.filter((l) => l !== "body").join(".");
        return field ? `${field}: ${d.msg}` : d.msg;
      })
      .join("; ");
  return null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Accept: "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(
      "Can't reach the hotel server. It may be waking up or blocked by the browser (CORS). Try again shortly.",
      0,
    );
  }
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const detail = body && typeof body === "object" ? formatDetail((body as { detail?: unknown }).detail) : null;
    const msg: string = detail || `Request failed (${res.status} ${res.statusText})`;
    throw new ApiError(msg, res.status);
  }
  return body as T;
}

// ---------- Types (from /openapi.json + live responses) ----------
export type RoomStatus = "available" | "occupied" | "maintenance" | string;
export interface Room {
  id: number;
  room_number: string;
  room_type: string;
  price_per_night: number;
  capacity: number;
  status: RoomStatus;
}
export type RoomInput = Omit<Room, "id">;

export interface Guest {
  id: number;
  name: string;
  email: string | null;
  phone: string;
}
export type GuestInput = Omit<Guest, "id">;

export interface Dashboard {
  total_rooms: number;
  occupied_rooms: number;
  available_rooms: number;
  maintenance_rooms: number;
  total_guests: number;
  upcoming_reservations: number;
  occupancy_percentage: number;
}

export interface ReservationInput {
  guest_id: number;
  room_ids: number[];
  check_in: string;
  check_out: string;
}

// The reservation response schema is not documented by the API (schema: {}),
// so it is normalized defensively here. Adjust this function if the shape differs.
export interface Reservation {
  id: number;
  guest_id: number | null;
  guest: Partial<Guest> | null;
  rooms: Partial<Room>[];
  room_ids: number[];
  check_in: string;
  check_out: string;
  status: string;
  total_price: number | null;
  raw: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeReservation(r: any): Reservation {
  const rooms: Partial<Room>[] = Array.isArray(r.rooms)
    ? r.rooms.map((x: any) => (x && typeof x === "object" && "room" in x ? x.room : x))
    : r.room
      ? [r.room]
      : [];
  const room_ids: number[] = Array.isArray(r.room_ids)
    ? r.room_ids
    : rooms.map((x) => x.id).filter((x): x is number => typeof x === "number");
  const price = r.total_price ?? r.total_amount ?? r.total ?? r.price ?? null;
  return {
    id: r.id,
    guest_id: r.guest_id ?? r.guest?.id ?? null,
    guest: r.guest ?? (r.guest_name ? { name: r.guest_name } : null),
    rooms,
    room_ids,
    check_in: r.check_in,
    check_out: r.check_out,
    status: r.status ?? "unknown",
    total_price: price == null ? null : Number(price),
    raw: r,
  };
}

const qs = (params: Record<string, string | undefined>) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const api = {
  dashboard: () => request<Dashboard>("/dashboard"),
  rooms: {
    list: (params: { search?: string; status?: string } = {}) =>
      request<Room[]>(`/rooms${qs(params)}`),
    get: (id: number) => request<Room>(`/rooms/${id}`),
    create: (data: RoomInput) => request<Room>("/rooms", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: RoomInput) =>
      request<Room>(`/rooms/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (id: number) => request<null>(`/rooms/${id}`, { method: "DELETE" }),
  },
  guests: {
    list: (params: { search?: string } = {}) => request<Guest[]>(`/guests${qs(params)}`),
    create: (data: GuestInput) => request<Guest>("/guests", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: GuestInput) =>
      request<Guest>(`/guests/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (id: number) => request<null>(`/guests/${id}`, { method: "DELETE" }),
  },
  reservations: {
    list: async (params: { status?: string } = {}) =>
      (await request<unknown[]>(`/reservations${qs(params)}`)).map(normalizeReservation),
    create: async (data: ReservationInput) =>
      normalizeReservation(
        await request<unknown>("/reservations", { method: "POST", body: JSON.stringify(data) }),
      ),
    cancel: async (id: number) =>
      normalizeReservation(await request<unknown>(`/reservations/${id}/cancel`, { method: "PATCH" })),
  },
};
