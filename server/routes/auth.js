const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { authMiddleware, JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

const PREDEFINED_ROOMS = ["devops", "cloud computing", "covid19", "sports", "nodeJS", "javascript", "python"];

router.post("/signup", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const existingUser = await User.findOne({ username: username.trim() });
    if (existingUser) {
      return res.status(400).json({ error: "Username already taken" });
    }

    const user = new User({ username: username.trim(), password });
    await user.save();

    const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      token,
      user: { id: user._id, username: user.username },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      token,
      user: { id: user._id, username: user.username },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/user", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

router.get("/rooms", (req, res) => {
  res.json({ rooms: PREDEFINED_ROOMS });
});

module.exports = router;
