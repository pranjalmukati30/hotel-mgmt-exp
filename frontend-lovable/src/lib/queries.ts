import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "./api";

export const keys = {
  dashboard: ["dashboard"] as const,
  rooms: ["rooms"] as const,
  guests: ["guests"] as const,
  reservations: ["reservations"] as const,
};

export const useDashboard = () => useQuery({ queryKey: keys.dashboard, queryFn: api.dashboard });
export const useRooms = () => useQuery({ queryKey: keys.rooms, queryFn: () => api.rooms.list() });
export const useGuests = () => useQuery({ queryKey: keys.guests, queryFn: () => api.guests.list() });
export const useReservations = () =>
  useQuery({ queryKey: keys.reservations, queryFn: () => api.reservations.list() });

/** Mutation that invalidates every list + dashboard after the API confirms success. */
export function useApiMutation<TVars, TRes>(
  fn: (v: TVars) => Promise<TRes>,
  successMessage: string,
  onDone?: () => void,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      Object.values(keys).forEach((k) => qc.invalidateQueries({ queryKey: k }));
      toast.success(successMessage);
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
