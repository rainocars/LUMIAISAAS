import axios from "axios";

const baseURL = `${process.env.REACT_APP_BACKEND_URL}/api/management`;
export const managementApi = axios.create({ baseURL, timeout: 20000 });

managementApi.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("lumi.management.token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

managementApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes("auth/login")) {
      sessionStorage.removeItem("lumi.management.token");
      sessionStorage.removeItem("lumi.management.user");
      window.dispatchEvent(new Event("management-auth-expired"));
    }
    return Promise.reject(error);
  },
);

export const apiError = (error) => error.response?.data?.detail || "Something went wrong. Please try again.";
