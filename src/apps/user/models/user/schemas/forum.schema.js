import mongoose from "mongoose";

const savedThreadSchema = new mongoose.Schema({
  thread: { type: mongoose.Schema.Types.ObjectId, ref: 'Forumthread' },
  savedAt: { type: Date, default: Date.now }
}, { _id: false });

const forumActivitySchema = new mongoose.Schema({
  threads: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Forumthread' }],
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Forumcomment' }],
  likedThreads: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Forumthread' }],
  likedComments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Forumcomment' }],
  savedThreads: [savedThreadSchema],
  followedThreads: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Forumthread' }],
  followedTopics: [{ type: String, trim: true, lowercase: true }]
}, { _id: false });

export default forumActivitySchema;
