import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";

async function seedSuperAdmin() {
  try {
    const name = process.env.SUPER_ADMIN_NAME?.trim();
    const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!name || !email || !password) {
      throw new Error(
        "SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required in .env"
      );
    }

    if (password.length < 8) {
      throw new Error("SUPER_ADMIN_PASSWORD must contain at least 8 characters.");
    }

    await connectDB();

    let user = await User.findOne({ email }).select("+password");

    if (!user) {
      user = await User.create({
        name,
        email,
        password,
        role: "SUPER_ADMIN",
        isActive: true,
      });
      console.log(`SUPER_ADMIN created: ${user.email}`);
    } else {
      user.name = name;
      user.password = password;
      user.role = "SUPER_ADMIN";
      user.isActive = true;
      await user.save();
      console.log(`SUPER_ADMIN updated: ${user.email}`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedSuperAdmin();
