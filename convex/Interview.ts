
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const SaveInterviewQuestion = mutation({
    args: {
        questions: v.any(),
        uid: v.id('UserTable'),
        resumeUrl: v.optional(v.string()),
        jobTitle: v.optional(v.string()),
        jobDescription: v.optional(v.string()),
        videoRequired: v.optional(v.boolean()),

    },
    handler: async (ctx, args) => {
        const result = await ctx.db.insert('InterviewSessionTable', {
            interviewQuestions: args.questions,
            resumeUrl: args.resumeUrl ?? null,
            userId: args.uid,
            status: 'draft',
            jobTitle: args.jobTitle ?? null,
            jobDescription: args.jobDescription ?? null,
            videoRequired: args.videoRequired ?? undefined
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

export const CompleteInterview = mutation({
    args: {
        recordId: v.id('InterviewSessionTable')
    },
    handler: async (ctx, args) => {
        const result = await ctx.db.patch(args.recordId, {
            status: 'completed',
            completedAt: Date.now()
        });
        return result;
    }
})

export const StartInterview = mutation({
    args: {
        recordId: v.id('InterviewSessionTable'),
        candidateName: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        const result = await ctx.db.patch(args.recordId, {
            status: 'in_progress',
            startedAt: Date.now(),
            currentQuestionIndex: 0,
            candidateName: args.candidateName
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
        try {
           
            
            // Query all interviews for this user
            const result = await ctx.db.query('InterviewSessionTable')
                .filter(q => q.eq(q.field('userId'), args.uid))
                .collect();
            
          
            
            // Sort by completedAt or startedAt descending (most recent first)
            const sorted = result.sort((a, b) => {
                const aTime = a.completedAt ?? a.startedAt ?? 0;
                const bTime = b.completedAt ?? b.startedAt ?? 0;
                return bTime - aTime;
            });
            
            console.log('GetInterviewList returning', sorted.length, 'sorted interviews');
            return sorted;
        } catch (error) {
            console.error('GetInterviewList error:', error);
            throw error;
        }
    }
})

export const SaveQAPair = mutation({
    args: {
        recordId: v.id('InterviewSessionTable'),
        question: v.string(),
        answer: v.string(),
        questionIndex: v.number()
    },
    handler: async (ctx, args) => {
        const record = await ctx.db.get(args.recordId);
        if (!record) {
            throw new Error('Interview record not found');
        }

        const existingQAPairs = record.qaPairs || [];
        const updatedQAPairs = [...existingQAPairs, {
            question: args.question,
            answer: args.answer,
            questionIndex: args.questionIndex,
            timestamp: Date.now()
        }];

        await ctx.db.patch(args.recordId, {
            qaPairs: updatedQAPairs
        });

        return { success: true };
    }
})