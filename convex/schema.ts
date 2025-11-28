import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    UserTable: defineTable({
        name: v.string(),
        imageUrl: v.string(),
        email: v.string(),
    }),

    QuestionBankTable: defineTable({
        question: v.string(),
        answer: v.string(),
        programType: v.optional(v.string()),
        courseTitle: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number()
    }),

    InterviewSessionTable: defineTable({
        interviewQuestions: v.any(),
        resumeUrl: v.union(v.string(), v.null()),
        userId: v.id('UserTable'),
        status: v.string(), // 'draft', 'in_progress', 'completed'
        jobTitle: v.union(v.string(), v.null()),
        jobDescription: v.union(v.string(), v.null()),
        videoRequired: v.optional(v.boolean()),
        feedback: v.optional(v.any()),
        conversation: v.optional(v.any()), // Conversation history
        currentQuestionIndex: v.optional(v.number()),
        startedAt: v.optional(v.number()),
        completedAt: v.optional(v.number())
    })
})