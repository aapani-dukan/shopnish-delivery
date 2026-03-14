import { QueryClient, QueryFunction } from "@tanstack/react-query";
import api from "./api"; // Aapka axios instance
import { logoutUser } from "../services/authService";

export async function apiRequest(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  path: string,
  data?: any
): Promise<any> {
  try {
    const config: any = {
      method,
      url: path,
    };

    if (method === "GET" && data) {
      config.params = data;
    } else if (data) {
      config.data = data;
    }

    const res = await api(config);
    return res.data;
  } catch (error: any) {
    if (error.response) {
      const message = error.response.data.message || error.response.data.error || "Request failed";
      const customError: any = new Error(message);
      customError.status = error.response.status;

      // 🚩 Important: Unauthorized/Session Expired handling
      if (error.response.status === 401) {
        console.warn("Session expired. Logging out...");
        await logoutUser(); 
      }
      throw customError;
    }
    throw new Error("Network issue. Please check your connection.");
  }
}

export const getQueryFn = <T,>(): QueryFunction<T | null> =>
  async ({ queryKey }) => {
    const path = queryKey[0] as string;
    const params = queryKey.length > 1 ? queryKey[1] : undefined; 
    const res = await apiRequest("GET", path, params);
    return res as T;
  };

// Global Query Client Configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn(),
      refetchOnWindowFocus: true, // Delivery app mein jab app wapas khule toh orders refresh hone chahiye
      staleTime: 1000 * 10,       // 🚩 Sirf 10 seconds tak data fresh rahega (Orders are dynamic)
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.status === 403) return false;
        return failureCount < 1;
      },
    },
  },
});