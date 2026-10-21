import jwt from "jsonwebtoken";
import User from "../models/User.js";

/* =========================================================
   GET USER ID FROM JWT
========================================================= */

const getUserIdFromPayload = (payload) => {
  return payload?._id || payload?.id || payload?.userId || payload?.sub || null;
};

/* =========================================================
   AUTHENTICATE

   Header:
   Authorization: Bearer <token>
========================================================= */

export const authenticate = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format.",
      });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing.",
      });
    }

    /* =====================================================
       VERIFY JWT
    ===================================================== */

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userId = getUserIdFromPayload(decoded);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    /* =====================================================
       LOAD LATEST USER FROM DATABASE

       Better than trusting role/status only from JWT.
    ===================================================== */

    const user = await User.findById(userId).select(
      "name username email role modulePermissions isActive",
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive.",
      });
    }

    /* =====================================================
       REQUEST USER

       Keep common fields so old code still works.
    ===================================================== */

    req.user = {
      _id: user._id,
      id: user._id.toString(),
      userId: user._id.toString(),

      name: user.name,
      username: user.username || "",
      email: user.email,

      role: user.role,

      modulePermissions: Array.isArray(user.modulePermissions)
        ? user.modulePermissions
        : [],

      isActive: user.isActive,
    };

    /*
     * Full mongoose user for newer middleware/controllers.
     */
    req.currentUser = user;

    return next();
  } catch (error) {
    console.error("AUTH MIDDLEWARE ERROR:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Your session has expired. Please sign in again.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Authentication failed.",
    });
  }
};

/* =========================================================
   ALLOW ROLES

   Examples:

   allowRoles("SUPER_ADMIN")

   allowRoles(
     "SUPER_ADMIN",
     "USER"
   )
========================================================= */

export const allowRoles = (...roles) => {
  return (req, res, next) => {
    const role = req.currentUser?.role || req.user?.role;

    if (!role) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!roles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource.",
      });
    }

    return next();
  };
};
