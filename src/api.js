export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || '/api';

export const ADMIN_TOKEN_KEY = 'paimana_admin_token';

export const getAdminAuthHeaders = () => {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
};
