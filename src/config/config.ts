import "dotenv/config";
import type { Algorithm, SignOptions } from "jsonwebtoken";

export function getRequiredEnv(key: string): string {
	const value = process.env[key];

	if (!value) {
		throw new Error(`${key} is not defined`);
	}

	return value;
}

export function getJwtSecret(): string {
	return getRequiredEnv("JWT_SECRET");
}

export const JWT_ALGORITHM: Algorithm = "HS256";

export function getJwtIssuer(): string {
	return getRequiredEnv("JWT_ISSUER");
}

export function getJwtAudience(): string {
	return getRequiredEnv("JWT_AUDIENCE");
}

export function getJwtExpiresIn(): NonNullable<SignOptions["expiresIn"]> {
	return getRequiredEnv("JWT_EXPIRES_IN") as NonNullable<SignOptions["expiresIn"]>;
}

export function getBcryptSaltRounds(): number {
	const value = Number.parseInt(getRequiredEnv("SALT_ROUNDS"), 10);

	if (Number.isNaN(value)) {
		throw new Error("SALT_ROUNDS must be a valid integer");
	}

	if (value < 8 || value > 15) {
		throw new Error("SALT_ROUNDS must be between 8 and 15");
	}

	return value;
}
