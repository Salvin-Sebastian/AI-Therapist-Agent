import mongoose from "mongoose";

/* ---------------- MESSAGE ---------------- */
const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "assistant"],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

/* ---------------- SESSION ---------------- */
const sessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true
    },

    userId: {
      type: String,
      required: true,
      index: true
    },

    title: {
      type: String,
      default: "New Session"
    },

    messages: [messageSchema],

    summary: {
      type: String,
      default: ""
    },

    copingSteps: {
      type: [String],
      default: []
    },

    /* 🔥 THIS WAS MISSING */
    saved: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true // createdAt + updatedAt
  }
);

/* ---------------- INDEX ---------------- */
sessionSchema.index(
  { sessionId: 1, userId: 1 },
  { unique: true }
);

export default mongoose.model("Session", sessionSchema);
