import mongoose from "mongoose";

const savedThreadSchema = new mongoose.Schema({
  thread: { type: mongoose.Schema.Types.ObjectId, ref: 'Thread' },
  savedAt: { type: Date, default: Date.now }
}, { _id: false });

const forumActivitySchema = new mongoose.Schema({
  threads: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Thread' }],
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
  likedThreads: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Thread' }],
  likedComments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
  savedThreads: [savedThreadSchema]
}, { _id: false });

export default forumActivitySchema;