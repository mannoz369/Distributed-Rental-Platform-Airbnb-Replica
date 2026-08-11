const mongoose = require("mongoose");
const Schema = mongoose.Schema;


const refreshTokenSchema = new Schema(
    {
        tokenHash: {
            type: String,
            required: true,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false }
);

const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    passwordHash: {
        type: String,
    },
    passwordSalt: {
        type: String,
    },
    hash: String,
    salt: String,
    role: {
        type: String,
        default: "guest",
    },
    refreshTokens: {
        type: [refreshTokenSchema],
        default: [],
    },
});

module.exports = mongoose.model("User", userSchema);
