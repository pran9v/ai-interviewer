import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

// Schema for saved questions
export const schema = {
    questionBank: {
        question: v.string(),
        answer: v.string(),
        programType: v.optional(v.string()),
        courseTitle: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number()
    }
};

// Get all saved questions
export const GetSavedQuestions = query({
    args: {},
    handler: async (ctx) => {
        const questions = await ctx.db.query('QuestionBankTable')
            .order('desc')
            .collect();
        return questions;
    }
});

// Save a new question to the bank
export const SaveQuestionToBank = mutation({
    args: {
        question: v.string(),
        answer: v.string(),
        programType: v.optional(v.string()),
        courseTitle: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        const questionId = await ctx.db.insert('QuestionBankTable', {
            ...args,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
        return questionId;
    }
});

// Update an existing question
export const UpdateQuestionInBank = mutation({
    args: {
        questionId: v.id('QuestionBankTable'),
        question: v.string(),
        answer: v.string(),
        programType: v.optional(v.string()),
        courseTitle: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        const { questionId, ...updates } = args;
        await ctx.db.patch(questionId, {
            ...updates,
            updatedAt: Date.now()
        });
    }
});

// Delete a question
export const DeleteQuestionFromBank = mutation({
    args: {
        questionId: v.id('QuestionBankTable')
    },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.questionId);
    }
});