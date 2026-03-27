import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  getBcryptSaltRounds,
  getJwtAudience,
  getJwtExpiresIn,
  getJwtIssuer,
  getJwtSecret,
  JWT_ALGORITHM,
} from "../config/config";
import userModel from "../model/userModel";

const SALT_ROUNDS = getBcryptSaltRounds();

// Signup function to create a new user with hashed password
async function signup(email: string, password: string) {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await userModel.createUser(email, hashedPassword);

  return { id: user.id, email: user.email, role: user.role };
}

// login function to authenticate user and return a token (not implemented here)
async function login(email: string, password: string) {
  const user = await userModel.findUserByEmail(email);

  if (!user) {
    throw new Error("Invalid Email or password");
  }
  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) {
    throw new Error("Invalid Email or password");
  }

  // Token generation logic would go here (e.g., JWT)
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role ?? "user" },
    getJwtSecret(),
    {
      algorithm: JWT_ALGORITHM,
      audience: getJwtAudience(),
      issuer: getJwtIssuer(),
      expiresIn: getJwtExpiresIn(),
    },
  );
  // do not return the password hash
  return { token, user: { id: user.id, email: user.email, role: user.role } };
}

export { signup, login };
