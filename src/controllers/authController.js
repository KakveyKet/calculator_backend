import jwt from "jsonwebtoken";

import User from "../models/User.js";

/* =========================================================
   TOKEN
========================================================= */

const createAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),

      role: user.role,
    },

    process.env.JWT_SECRET,

    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    },
  );
};

/* =========================================================
   LOGIN

   Supports:

   identifier = username

   OR

   identifier = email
========================================================= */

export const login = async (req, res) => {
  try {
    const { identifier, email, username, password } = req.body;

    /* =====================================================
       LOGIN VALUE
    ===================================================== */

    const loginValue = String(identifier || email || username || "")
      .trim()
      .toLowerCase();

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!loginValue) {
      return res.status(400).json({
        success: false,

        message: "Username or email is required.",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,

        message: "Password is required.",
      });
    }

    /* =====================================================
       FIND USER

       +password because password has select:false
    ===================================================== */

    const user = await User.findOne({
      $or: [
        {
          email: loginValue,
        },

        {
          username: loginValue,
        },
      ],
    }).select(
      "+password name username email role modulePermissions isActive lastLoginAt createdAt updatedAt",
    );

    /* =====================================================
       NOT FOUND
    ===================================================== */

    if (!user) {
      console.log("LOGIN USER NOT FOUND:", loginValue);

      return res.status(401).json({
        success: false,

        message: "Username or email is incorrect.",
      });
    }

    /* =====================================================
       ACTIVE
    ===================================================== */

    if (!user.isActive) {
      return res.status(403).json({
        success: false,

        message: "Your account is inactive.",
      });
    }

    /* =====================================================
       PASSWORD
    ===================================================== */

    const passwordMatched = await user.comparePassword(String(password));

    if (!passwordMatched) {
      console.log("PASSWORD INCORRECT:", user.email);

      return res.status(401).json({
        success: false,

        message: "Password is incorrect.",
      });
    }

    /* =====================================================
       LOGIN TIME

       updateOne avoids validation problem for old users.
    ===================================================== */

    const lastLoginAt = new Date();

    await User.updateOne(
      {
        _id: user._id,
      },

      {
        $set: {
          lastLoginAt,
        },
      },
    );

    /* =====================================================
       JWT
    ===================================================== */

    const accessToken = createAccessToken(user);

    /* =====================================================
       RESPONSE USER
    ===================================================== */

    const safeUser = {
      _id: user._id,

      name: user.name,

      username: user.username || "",

      email: user.email,

      role: user.role,

      modulePermissions: Array.isArray(user.modulePermissions)
        ? user.modulePermissions
        : [],

      isActive: user.isActive,

      lastLoginAt,
    };

    return res.status(200).json({
      success: true,

      message: "Login successful.",

      accessToken,

      user: safeUser,
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "Unable to login.",
    });
  }
};
