import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/* =========================================================
   AVAILABLE MODULES
========================================================= */

export const USER_MODULES = [
  "CALCULATOR",
  "INVOICES",
  "CATEGORIES",
  "SUB_CATEGORIES",
  "USERS",
];

/* =========================================================
   USER SCHEMA
========================================================= */

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 100,
    },

    /*
     * Optional for compatibility with old accounts.
     *
     * New users can have a username.
     */
    username: {
      type: String,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 50,
      default: null,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false,
    },

    role: {
      type: String,
      enum: ["USER", "SUPER_ADMIN"],
      default: "USER",
      index: true,
    },

    modulePermissions: {
      type: [
        {
          type: String,
          enum: USER_MODULES,
        },
      ],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

/* =========================================================
   UNIQUE USERNAME

   Sparse = users without username are allowed.
========================================================= */

userSchema.index(
  {
    username: 1,
  },
  {
    unique: true,
    sparse: true,
  },
);

/* =========================================================
   PASSWORD HASH
========================================================= */

userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
});

/* =========================================================
   PASSWORD COMPARE
========================================================= */

userSchema.methods.comparePassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

/* =========================================================
   JSON
========================================================= */

userSchema.set("toJSON", {
  transform(document, returnedObject) {
    delete returnedObject.password;
    delete returnedObject.__v;

    return returnedObject;
  },
});

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
