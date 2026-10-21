import User from "../models/User.js";

/* =========================================================
   GET USER ID
========================================================= */

const getUserId = (req) => {
  return (
    req.user?._id || req.user?.id || req.user?.userId || req.user?.sub || null
  );
};

/* =========================================================
   LOAD USER
========================================================= */

const loadUser = async (req) => {
  const userId = getUserId(req);

  if (!userId) {
    return null;
  }

  return User.findById(userId).select(
    "name username email role modulePermissions isActive",
  );
};

/* =========================================================
   REQUIRE MODULE
========================================================= */

export const requireModule = (moduleName) => {
  return async (req, res, next) => {
    try {
      const user = await loadUser(req);

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

      req.currentUser = user;

      /* ===================================================
         SUPER ADMIN
      =================================================== */

      if (user.role === "SUPER_ADMIN") {
        return next();
      }

      const permissions = Array.isArray(user.modulePermissions)
        ? user.modulePermissions
        : [];

      if (!permissions.includes(moduleName)) {
        return res.status(403).json({
          success: false,

          message: `Access denied to ${moduleName}.`,
        });
      }

      return next();
    } catch (error) {
      console.error("MODULE PERMISSION ERROR:", error);

      return res.status(500).json({
        success: false,

        message: "Unable to verify permission.",
      });
    }
  };
};

/* =========================================================
   REQUIRE ANY MODULE
========================================================= */

export const requireAnyModule = (...moduleNames) => {
  return async (req, res, next) => {
    try {
      const user = await loadUser(req);

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

      req.currentUser = user;

      if (user.role === "SUPER_ADMIN") {
        return next();
      }

      const permissions = Array.isArray(user.modulePermissions)
        ? user.modulePermissions
        : [];

      const allowed = moduleNames.some((moduleName) =>
        permissions.includes(moduleName),
      );

      if (!allowed) {
        return res.status(403).json({
          success: false,

          message: "You do not have permission to access this resource.",
        });
      }

      return next();
    } catch (error) {
      console.error("MODULE PERMISSION ERROR:", error);

      return res.status(500).json({
        success: false,

        message: "Unable to verify permission.",
      });
    }
  };
};
