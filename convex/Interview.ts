
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const SaveInterviewQuestion = mutation({
    args: {
        questions: v.any(),
        uid: v.id('UserTable'),
        resumeUrl: v.optional(v.string()),
        jobTitle: v.optional(v.string()),
        jobDescription: v.optional(v.string())

    },
    handler: async (ctx, args) => {
        const result = await ctx.db.insert('InterviewSessionTable', {
            interviewQuestions: args.questions,
            resumeUrl: args.resumeUrl ?? null,
            userId: args.uid,
            status: 'draft',
            jobTitle: args.jobTitle ?? null,
            jobDescription: args.jobDescription ?? null
        });
        return result;
    }
})


export const GetInterviewQuestions = query({
    args: {
        interviewRecordId: v.id('InterviewSessionTable')
    },
    handler: async (ctx, args) => {
        const result = await ctx.db.query('InterviewSessionTable')
            .filter(q => q.eq(q.field('_id'), args.interviewRecordId))
            .collect();

        return result[0];
    }

})

export const UpdateFeedback = mutation({
    args: {
        recordId: v.id('InterviewSessionTable'),
        feedback: v.any()
    },
    handler: async (ctx, args) => {
        const result = await ctx.db.patch(args.recordId, {
            feedback: args.feedback,
            status: 'completed',
            completedAt: Date.now()
        });
        return result;
    }
})

export const StartInterview = mutation({
    args: {
        recordId: v.id('InterviewSessionTable')
    },
    handler: async (ctx, args) => {
        const result = await ctx.db.patch(args.recordId, {
            status: 'in_progress',
            startedAt: Date.now(),
            currentQuestionIndex: 0
        });
        return result;
    }
})

export const UpdateConversation = mutation({
    args: {
        recordId: v.id('InterviewSessionTable'),
        conversation: v.any(),
        currentQuestionIndex: v.number()
    },
    handler: async (ctx, args) => {
        const result = await ctx.db.patch(args.recordId, {
            conversation: args.conversation,
            currentQuestionIndex: args.currentQuestionIndex
        });
        return result;
    }
})

export const UpdateInterviewQuestions = mutation({
  args: {
    recordId: v.id('InterviewSessionTable'),
    questions: v.any()
  },
  handler: async (ctx, args) => {
    return ctx.db.patch(args.recordId, {
      interviewQuestions: args.questions
    });
  }
});

export const GetInterviewList = query({
    args: {
        uid: v.id('UserTable')
    },
    handler: async (ctx, args) => {
        const result = await ctx.db.query('InterviewSessionTable')
            .filter(q => q.eq(q.field('userId'), args.uid))
            .order('desc')
            .collect();

        return result;
    }
})