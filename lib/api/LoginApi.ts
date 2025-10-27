// User registration API for /auth/register
export const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

export interface RegisterPayload {
	email: string;
	name: string;
	password: string;
	phone?: string;
	date_of_birth?: string; // ISO string
}

export interface User {
	id: string;
	email: string;
	name: string;
	phone: string;
	date_of_birth: string;
	is_active: boolean;
	is_verified: boolean;
	created_at: string;
	updated_at: string;
	last_login: string;
}

export interface Tokens {
	access_token: string;
	refresh_token: string;
	token_type: string;
}

export interface RegisterResponse {
	user: User;
	tokens: Tokens;
}

export class ApiError extends Error {
	status?: number;
	data?: any;
	constructor(message: string, status?: number, data?: any) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.data = data;
	}
}

export async function register(payload: RegisterPayload): Promise<RegisterResponse> {
	try {
		// Omit undefined or empty optional fields from the request body
		const bodyPayload: Record<string, any> = { ...payload };
		if (bodyPayload.phone === undefined || bodyPayload.phone === "") {
			delete bodyPayload.phone;
		}
		if (bodyPayload.date_of_birth === undefined || bodyPayload.date_of_birth === "") {
			delete bodyPayload.date_of_birth;
		}
		const res = await fetch(`${API_BASE_URL}/auth/register`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(bodyPayload),
		});

		const data = await res.json();

		if (!res.ok) {
			throw new ApiError(data?.detail || "Registration failed", res.status, data);
		}

		return data as RegisterResponse;
	} catch (err: any) {
		if (err instanceof ApiError) throw err;
		throw new ApiError(err.message || "Network error");
	}
}

// Login API for /auth/login
export interface LoginPayload {
	email: string;
	password: string;
}

export type LoginResponse = RegisterResponse;

export async function login(payload: LoginPayload): Promise<LoginResponse> {
	if (!payload.email) {
		throw new ApiError("Email is required", 400);
	}
	try {
		const res = await fetch(`${API_BASE_URL}/auth/login`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		const data = await res.json();

		if (!res.ok) {
			throw new ApiError(data?.detail || "Login failed", res.status, data);
		}

		return data as LoginResponse;
	} catch (err: any) {
		if (err instanceof ApiError) throw err;
		throw new ApiError(err.message || "Network error");
	}
}

// Forgot Password API for /auth/forgot-password
export interface ForgotPasswordPayload {
	email: string;
}

export interface ForgotPasswordResponse {
	message: string;
}

export async function forgotPassword(payload: ForgotPasswordPayload): Promise<ForgotPasswordResponse> {
	if (!payload.email) {
		throw new ApiError("Email is required", 400);
	}
	
	// console.log("API_BASE_URL:", API_BASE_URL);
	// console.log("Making request to:", `${API_BASE_URL}/auth/forgot-password`);
	// console.log("Payload:", payload);
	
	try {
		const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		// console.log("Response status:", res.status);
		// console.log("Response headers:", res.headers);

		const data = await res.json();
		// console.log("Response data:", data);

		if (!res.ok) {
			throw new ApiError(data?.detail || "Failed to send reset email", res.status, data);
		}

		return data as ForgotPasswordResponse;
	} catch (err: any) {
		console.error("Fetch error:", err);
		if (err instanceof ApiError) throw err;
		throw new ApiError(err.message || "Network error");
	}
}