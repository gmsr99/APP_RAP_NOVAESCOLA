import axios from 'axios';
import { supabase } from './supabase';

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to include the auth token derived from Supabase session
api.interceptors.request.use(
    async (config) => {
        // Get the current session from Supabase
        // Supabase client handles caching/refreshing automatically
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token) {
            config.headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);
