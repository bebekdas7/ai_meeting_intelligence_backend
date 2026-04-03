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
import { insertCreditTransaction } from "../model/creditTransactionModel";

const SALT_ROUNDS = getBcryptSaltRounds();

// Signup function to create a new user with hashed password
async function signup(name: string, email: string, password: string) {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await userModel.createUser(name, email, hashedPassword);

  // Seed 2 free credits (no expiry) for new free users
  await insertCreditTransaction({
    user_id: user.id,
    type: "credit",
    amount: 2,
    source: "signup_free",
    expiry: null,
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    plan: user.current_plan,
  };
}

// login function to authenticate user and return a token
async function login(email: string, password: string) {
  const user = await userModel.findUserByEmail(email);

  if (!user) {
    throw new Error("Invalid Email or password");
  }
  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) {
    throw new Error("Invalid Email or password");
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: "user" },
    getJwtSecret(),
    {
      algorithm: JWT_ALGORITHM,
      audience: getJwtAudience(),
      issuer: getJwtIssuer(),
      expiresIn: getJwtExpiresIn(),
    },
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.current_plan,
      plan_expiry: user.plan_expiry,
    },
  };
}

export { signup, login };
