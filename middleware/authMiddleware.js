import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Reads the JWT from the Authorization header, verifies it, loads the user.
// On success: attaches req.user and calls next().
// On failure: 401 — the client should treat this as "logged out" and clear its token.
export default async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ success: false, message: "Missing or invalid Authorization header" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ success: false, message: "User no longer exists" });
    }

    req.user = user;
    return next();
  } catch (err) {
    // jwt errors: TokenExpiredError, JsonWebTokenError, etc.
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}
