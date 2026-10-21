import mongoose from "mongoose";

import User, { USER_MODULES } from "../models/User.js";

/* =========================================================
   COMMON SELECT
========================================================= */

const USER_SELECT =
  "name username email role modulePermissions isActive lastLoginAt createdAt updatedAt";

/* =========================================================
   GET CURRENT REQUEST USER ID
========================================================= */

const getRequestUserId = (req) => {
  return (
    req.currentUser?._id ||
    req.user?._id ||
    req.user?.id ||
    req.user?.userId ||
    req.user?.sub ||
    null
  );
};

/* =========================================================
   SUPER ADMIN CHECK
========================================================= */

const isSuperAdmin = (req) => {
  return (
    req.currentUser?.role === "SUPER_ADMIN" || req.user?.role === "SUPER_ADMIN"
  );
};

/* =========================================================
   NORMALIZE EMAIL
========================================================= */

const normalizeEmail = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase();
};

/* =========================================================
   NORMALIZE USERNAME
========================================================= */

const normalizeUsername = (value) => {
  const username = String(value || "")
    .trim()
    .toLowerCase();

  return username || null;
};

/* =========================================================
   NORMALIZE MODULE PERMISSIONS
========================================================= */

const normalizePermissions = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) => String(item).trim().toUpperCase())
        .filter((item) => USER_MODULES.includes(item)),
    ),
  ];
};

/* =========================================================
   GET CURRENT USER

   GET /api/users/me
========================================================= */

export const getCurrentUser = async (req, res) => {
  try {
    const userId = getRequestUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,

        message: "Unable to identify current user.",
      });
    }

    const user = await User.findById(userId).select(USER_SELECT);

    if (!user) {
      return res.status(404).json({
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

    /* ===================================================
         EFFECTIVE MODULES
      =================================================== */

    const effectiveModulePermissions =
      user.role === "SUPER_ADMIN"
        ? [...USER_MODULES]
        : Array.isArray(user.modulePermissions)
          ? [...user.modulePermissions]
          : [];

    return res.status(200).json({
      success: true,

      data: {
        ...user.toObject(),

        effectiveModulePermissions,
      },
    });
  } catch (error) {
    console.error("GET CURRENT USER ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Unable to load current user.",
    });
  }
};

/* =========================================================
   GET USERS

   GET /api/users
========================================================= */

export const getUsers = async (req, res) => {
  try {
    const query = {};

    /* ===================================================
         NORMAL USER CANNOT SEE SUPER ADMIN
      =================================================== */

    if (!isSuperAdmin(req)) {
      query.role = "USER";
    }

    /* ===================================================
         OPTIONAL SEARCH
      =================================================== */

    const search = String(req.query.search || "").trim();

    if (search) {
      query.$or = [
        {
          name: {
            $regex: search,

            $options: "i",
          },
        },

        {
          username: {
            $regex: search,

            $options: "i",
          },
        },

        {
          email: {
            $regex: search,

            $options: "i",
          },
        },
      ];
    }

    const users = await User.find(query).select(USER_SELECT).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,

      data: users,

      permissions: {
        currentUserRole: req.currentUser?.role || req.user?.role || "USER",

        canManageSuperAdmin: isSuperAdmin(req),

        canManagePermissions: isSuperAdmin(req),
      },
    });
  } catch (error) {
    console.error("GET USERS ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Unable to load users.",
    });
  }
};

/* =========================================================
   GET USER BY ID

   GET /api/users/:id
========================================================= */

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,

        message: "Invalid user ID.",
      });
    }

    const user = await User.findById(id).select(USER_SELECT);

    if (!user) {
      return res.status(404).json({
        success: false,

        message: "User not found.",
      });
    }

    /* ===================================================
         USER CANNOT SEE SUPER ADMIN
      =================================================== */

    if (!isSuperAdmin(req) && user.role === "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,

        message: "You cannot access this user.",
      });
    }

    return res.status(200).json({
      success: true,

      data: user,
    });
  } catch (error) {
    console.error("GET USER ERROR:", error);

    return res.status(500).json({
      success: false,

      message: "Unable to load user.",
    });
  }
};

/* =========================================================
   CREATE USER

   POST /api/users
========================================================= */

export const createUser = async (req, res) => {
  try {
    const {
      name,
      username,
      email,
      password,
      role,
      modulePermissions,
      isActive,
    } = req.body;

    /* ===================================================
         NAME
      =================================================== */

    const cleanName = String(name || "").trim();

    if (!cleanName) {
      return res.status(400).json({
        success: false,

        message: "Name is required.",
      });
    }

    /* ===================================================
         EMAIL
      =================================================== */

    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail) {
      return res.status(400).json({
        success: false,

        message: "Email is required.",
      });
    }

    /* ===================================================
         USERNAME

         Optional for old/current compatibility.
      =================================================== */

    const cleanUsername = normalizeUsername(username);

    if (cleanUsername && cleanUsername.length < 3) {
      return res.status(400).json({
        success: false,

        message: "Username must be at least 3 characters.",
      });
    }

    /* ===================================================
         PASSWORD
      =================================================== */

    if (!password || String(password).length < 8) {
      return res.status(400).json({
        success: false,

        message: "Password must be at least 8 characters.",
      });
    }

    /* ===================================================
         EMAIL DUPLICATE
      =================================================== */

    const emailExists = await User.findOne({
      email: cleanEmail,
    });

    if (emailExists) {
      return res.status(409).json({
        success: false,

        message: "Email already exists.",
      });
    }

    /* ===================================================
         USERNAME DUPLICATE
      =================================================== */

    if (cleanUsername) {
      const usernameExists = await User.findOne({
        username: cleanUsername,
      });

      if (usernameExists) {
        return res.status(409).json({
          success: false,

          message: "Username already exists.",
        });
      }
    }

    /* ===================================================
         ROLE
      =================================================== */

    let newRole = String(role || "USER").toUpperCase();

    if (!["USER", "SUPER_ADMIN"].includes(newRole)) {
      newRole = "USER";
    }

    /*
     * Normal users cannot create
     * SUPER_ADMIN.
     */

    if (!isSuperAdmin(req)) {
      newRole = "USER";
    }

    /* ===================================================
         MODULE PERMISSIONS
      =================================================== */

    let permissions = [];

    if (isSuperAdmin(req) && newRole === "USER") {
      permissions = normalizePermissions(modulePermissions);
    }

    /* ===================================================
         CREATE
      =================================================== */

    const user = await User.create({
      name: cleanName,

      username: cleanUsername,

      email: cleanEmail,

      password: String(password),

      role: newRole,

      modulePermissions: permissions,

      isActive: isActive !== false,
    });

    const result = await User.findById(user._id).select(USER_SELECT);

    return res.status(201).json({
      success: true,

      message: "User created successfully.",

      data: result,
    });
  } catch (error) {
    console.error("CREATE USER ERROR:", error);

    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];

      return res.status(409).json({
        success: false,

        message:
          field === "username"
            ? "Username already exists."
            : "Email already exists.",
      });
    }

    return res.status(400).json({
      success: false,

      message: error.message || "Unable to create user.",
    });
  }
};

/* =========================================================
   UPDATE USER

   PUT /api/users/:id
========================================================= */

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,

        message: "Invalid user ID.",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,

        message: "User not found.",
      });
    }

    /* ===================================================
         NORMAL USER CANNOT MANAGE SUPER ADMIN
      =================================================== */

    if (!isSuperAdmin(req) && user.role === "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,

        message: "You cannot manage a super admin.",
      });
    }

    /* ===================================================
         NAME
      =================================================== */

    if (req.body.name !== undefined) {
      const cleanName = String(req.body.name || "").trim();

      if (!cleanName) {
        return res.status(400).json({
          success: false,

          message: "Name is required.",
        });
      }

      user.name = cleanName;
    }

    /* ===================================================
         USERNAME
      =================================================== */

    if (req.body.username !== undefined) {
      const cleanUsername = normalizeUsername(req.body.username);

      if (cleanUsername && cleanUsername.length < 3) {
        return res.status(400).json({
          success: false,

          message: "Username must be at least 3 characters.",
        });
      }

      if (cleanUsername) {
        const exists = await User.findOne({
          username: cleanUsername,

          _id: {
            $ne: user._id,
          },
        });

        if (exists) {
          return res.status(409).json({
            success: false,

            message: "Username already exists.",
          });
        }
      }

      user.username = cleanUsername;
    }

    /* ===================================================
         EMAIL
      =================================================== */

    if (req.body.email !== undefined) {
      const cleanEmail = normalizeEmail(req.body.email);

      if (!cleanEmail) {
        return res.status(400).json({
          success: false,

          message: "Email is required.",
        });
      }

      const exists = await User.findOne({
        email: cleanEmail,

        _id: {
          $ne: user._id,
        },
      });

      if (exists) {
        return res.status(409).json({
          success: false,

          message: "Email already exists.",
        });
      }

      user.email = cleanEmail;
    }

    /* ===================================================
         PASSWORD
      =================================================== */

    if (req.body.password) {
      if (String(req.body.password).length < 8) {
        return res.status(400).json({
          success: false,

          message: "Password must be at least 8 characters.",
        });
      }

      user.password = String(req.body.password);
    }

    /* ===================================================
         ROLE
      =================================================== */

    if (req.body.role !== undefined) {
      const requestedRole = String(req.body.role).toUpperCase();

      if (!["USER", "SUPER_ADMIN"].includes(requestedRole)) {
        return res.status(400).json({
          success: false,

          message: "Invalid role.",
        });
      }

      /*
       * Only SUPER_ADMIN
       * can assign SUPER_ADMIN.
       */

      if (!isSuperAdmin(req) && requestedRole === "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,

          message: "You cannot assign SUPER_ADMIN.",
        });
      }

      const currentUserId = String(getRequestUserId(req) || "");

      /*
       * Prevent admin removing
       * their own role.
       */

      if (
        currentUserId === String(user._id) &&
        user.role === "SUPER_ADMIN" &&
        requestedRole !== "SUPER_ADMIN"
      ) {
        return res.status(400).json({
          success: false,

          message: "You cannot remove your own SUPER_ADMIN role.",
        });
      }

      user.role = requestedRole;
    }

    /* ===================================================
         MODULE PERMISSIONS

         Only SUPER_ADMIN can change them.
      =================================================== */

    if (req.body.modulePermissions !== undefined) {
      if (!isSuperAdmin(req)) {
        return res.status(403).json({
          success: false,

          message: "Only SUPER_ADMIN can change module permissions.",
        });
      }

      if (user.role === "USER") {
        user.modulePermissions = normalizePermissions(
          req.body.modulePermissions,
        );

        user.markModified("modulePermissions");
      }
    }

    /*
     * SUPER_ADMIN already has
     * access to all modules.
     */

    if (user.role === "SUPER_ADMIN") {
      user.modulePermissions = [];
    }

    /* ===================================================
         STATUS
      =================================================== */

    if (req.body.isActive !== undefined) {
      const requestedStatus = req.body.isActive === true;

      const currentUserId = String(getRequestUserId(req) || "");

      if (currentUserId === String(user._id) && requestedStatus === false) {
        return res.status(400).json({
          success: false,

          message: "You cannot deactivate your own account.",
        });
      }

      user.isActive = requestedStatus;
    }

    /* ===================================================
         SAVE
      =================================================== */

    await user.save();

    const result = await User.findById(user._id).select(USER_SELECT);

    return res.status(200).json({
      success: true,

      message: "User updated successfully.",

      data: result,
    });
  } catch (error) {
    console.error("UPDATE USER ERROR:", error);

    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];

      return res.status(409).json({
        success: false,

        message:
          field === "username"
            ? "Username already exists."
            : "Email already exists.",
      });
    }

    return res.status(400).json({
      success: false,

      message: error.message || "Unable to update user.",
    });
  }
};

/* =========================================================
   ACTIVATE / DEACTIVATE USER

   PATCH /api/users/:id/status
========================================================= */

export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,

        message: "Invalid user ID.",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,

        message: "User not found.",
      });
    }

    /* ===================================================
         NORMAL USER CANNOT MANAGE SUPER ADMIN
      =================================================== */

    if (!isSuperAdmin(req) && user.role === "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,

        message: "You cannot manage a super admin.",
      });
    }

    const requestedStatus = req.body.isActive === true;

    const currentUserId = String(getRequestUserId(req) || "");

    /* ===================================================
         CANNOT DEACTIVATE YOURSELF
      =================================================== */

    if (currentUserId === String(user._id) && requestedStatus === false) {
      return res.status(400).json({
        success: false,

        message: "You cannot deactivate your own account.",
      });
    }

    user.isActive = requestedStatus;

    await user.save();

    const result = await User.findById(user._id).select(USER_SELECT);

    return res.status(200).json({
      success: true,

      message: requestedStatus
        ? "User activated successfully."
        : "User deactivated successfully.",

      data: result,
    });
  } catch (error) {
    console.error("UPDATE USER STATUS ERROR:", error);

    return res.status(400).json({
      success: false,

      message: error.message || "Unable to update user status.",
    });
  }
};
