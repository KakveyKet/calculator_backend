import mongoose from "mongoose";
import dotenv from "dotenv";

import User from "../models/User.js";

dotenv.config();

/* =========================================================
   ENV
========================================================= */

const {
  MONGODB_URI,

  SUPER_ADMIN_NAME,
  SUPER_ADMIN_USERNAME,
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD,
} = process.env;

/* =========================================================
   VALIDATE ENV
========================================================= */

function validateEnvironment() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is required.");
  }

  if (!SUPER_ADMIN_NAME) {
    throw new Error("SUPER_ADMIN_NAME is required.");
  }

  if (!SUPER_ADMIN_USERNAME) {
    throw new Error("SUPER_ADMIN_USERNAME is required.");
  }

  if (!SUPER_ADMIN_EMAIL) {
    throw new Error("SUPER_ADMIN_EMAIL is required.");
  }

  if (!SUPER_ADMIN_PASSWORD) {
    throw new Error("SUPER_ADMIN_PASSWORD is required.");
  }

  if (SUPER_ADMIN_PASSWORD.length < 8) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 8 characters.");
  }
}

/* =========================================================
   SEED SUPER ADMIN
========================================================= */

async function seedSuperAdmin() {
  try {
    validateEnvironment();

    /* =====================================================
       CONNECT DATABASE
    ===================================================== */

    console.log("Connecting to MongoDB...");

    await mongoose.connect(MONGODB_URI);

    console.log("MongoDB connected.");

    /* =====================================================
       NORMALIZE
    ===================================================== */

    const username = SUPER_ADMIN_USERNAME.trim().toLowerCase();

    const email = SUPER_ADMIN_EMAIL.trim().toLowerCase();

    /* =====================================================
       FIND EXISTING ACCOUNT
    ===================================================== */

    let user = await User.findOne({
      $or: [
        {
          username,
        },
        {
          email,
        },
      ],
    });

    /* =====================================================
       ALREADY EXISTS
    ===================================================== */

    if (user) {
      console.log("Existing account found.");

      /*
       * Make sure this account is Super Admin.
       */

      user.name = SUPER_ADMIN_NAME.trim();

      user.username = username;

      user.email = email;

      user.role = "SUPER_ADMIN";

      user.isActive = true;

      /*
       * Super Admin does not need individual module
       * permissions because your permission logic gives
       * SUPER_ADMIN access to every module.
       */

      user.modulePermissions = [];

      await user.save();

      console.log("Super Admin updated successfully.");

      console.log(`Username: ${username}`);

      console.log(`Email: ${email}`);

      return;
    }

    /* =====================================================
       CREATE SUPER ADMIN
    ===================================================== */

    user = new User({
      name: SUPER_ADMIN_NAME.trim(),

      username,

      email,

      password: SUPER_ADMIN_PASSWORD,

      role: "SUPER_ADMIN",

      isActive: true,

      modulePermissions: [],
    });

    /*
     * Use save() instead of updateOne() so your User model's
     * password pre-save hook can hash the password.
     */

    await user.save();

    console.log("Super Admin created successfully.");

    console.log(`Username: ${username}`);

    console.log(`Email: ${email}`);
  } catch (error) {
    console.error("SUPER ADMIN SEED ERROR:");

    console.error(error.message);

    process.exitCode = 1;
  } finally {
    /* =====================================================
       DISCONNECT
    ===================================================== */

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    console.log("MongoDB disconnected.");
  }
}

/* =========================================================
   RUN
========================================================= */

seedSuperAdmin();
