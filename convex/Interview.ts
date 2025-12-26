
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

export const GetStudentsByInterview = query({
    args: {
        interviewId: v.union(v.id('InterviewSessionTable'), v.string()),
        ownerId: v.union(v.id('UserTable'), v.string())
    },
    handler: async (ctx, args) => {
        try {
            // Validate inputs - ensure they are valid Convex IDs
            if (!args.interviewId || typeof args.interviewId !== 'string' || args.interviewId.trim().length === 0) {
                console.warn('GetStudentsByInterview: Missing or invalid interviewId', args.interviewId);
                return [];
            }
            
            if (!args.ownerId || typeof args.ownerId !== 'string' || args.ownerId.trim().length === 0) {
                console.warn('GetStudentsByInterview: Missing or invalid ownerId', args.ownerId);
                return [];
            }
            
            // Convert to proper Convex ID types
            const interviewId = args.interviewId as any;
            const ownerId = args.ownerId as any;

            // Get the selected interview to find its jobDescription
            const selectedInterview = await ctx.db.get(interviewId) as any;
            if (!selectedInterview) {
                console.warn('GetStudentsByInterview: Interview not found', interviewId);
                return [];
            }
            
            // Verify the interview belongs to the owner
            if (selectedInterview.userId !== ownerId) {
                console.warn('GetStudentsByInterview: Interview does not belong to owner', {
                    interviewId: interviewId,
                    interviewUserId: selectedInterview.userId,
                    ownerId: ownerId
                });
                return [];
            }
            
            if (!selectedInterview.jobDescription || typeof selectedInterview.jobDescription !== 'string' || selectedInterview.jobDescription.trim().length === 0) {
                console.warn('GetStudentsByInterview: Interview has no valid jobDescription', {
                    interviewId: interviewId,
                    hasJobDescription: !!selectedInterview.jobDescription,
                    jobDescriptionType: typeof selectedInterview.jobDescription
                });
                return [];
            }

            // Find all interview sessions with the same jobDescription
            // that belong to the same owner (to avoid conflicts)
            let allInterviews: any[] = [];
            try {
                // Query all interviews for this user
                const queryResult = ctx.db.query('InterviewSessionTable')
                    .filter(q => q.eq(q.field('userId'), ownerId));
                
                allInterviews = await queryResult.collect();
                
                console.log('GetStudentsByInterview: Found', allInterviews.length, 'total interviews for user', ownerId);
            } catch (queryError: any) {
                console.error('GetStudentsByInterview: Error querying interviews', {
                    error: queryError?.message || String(queryError),
                    errorName: queryError?.name,
                    ownerId: ownerId,
                    ownerIdType: typeof ownerId,
                    stack: queryError?.stack
                });
                return [];
            }
            
            if (!Array.isArray(allInterviews)) {
                console.warn('GetStudentsByInterview: Query did not return an array', typeof allInterviews);
                return [];
            }

            // Normalize jobDescription for comparison (same logic as frontend)
            // Simple normalization: trim and lowercase to match frontend grouping
            const normalizeJD = (jd: string | null | undefined): string => {
                if (!jd || typeof jd !== 'string') return '';
                return jd.trim().toLowerCase();
            };
            
            const targetJD = normalizeJD(selectedInterview.jobDescription);
            
            if (!targetJD || targetJD.length === 0) {
                return [];
            }
            
            // Filter interviews that match the selected interview's jobDescription
            // Include only interviews that have a candidateName (student interviews)
            // The query finds ALL students with matching JD, regardless of which template was used
            console.log('GetStudentsByInterview: Filtering interviews', {
                totalInterviews: allInterviews.length,
                targetJD: targetJD,
                targetJDLength: targetJD.length
            });
            
            // Debug: Log sample interviews
            const sampleInterviews = allInterviews.slice(0, 5).map(i => ({
                id: String(i._id),
                hasJobDescription: !!i.jobDescription,
                jobDescription: i.jobDescription ? i.jobDescription.substring(0, 50) : 'N/A',
                normalizedJD: normalizeJD(i.jobDescription),
                hasCandidateName: !!i.candidateName,
                candidateName: i.candidateName || 'N/A'
            }));
            console.log('GetStudentsByInterview: Sample interviews:', sampleInterviews);
            
            const matchingInterviews = allInterviews.filter(interview => {
                if (!interview.jobDescription) {
                    return false;
                }
                
                const interviewJD = normalizeJD(interview.jobDescription);
                const matchesDescription = interviewJD === targetJD;
                const isStudentInterview = interview.candidateName && 
                    typeof interview.candidateName === 'string' && 
                    interview.candidateName.trim().length > 0;
                
                // Debug logging for each interview
                if (isStudentInterview) {
                    console.log('GetStudentsByInterview: Checking student interview', {
                        id: String(interview._id),
                        candidateName: interview.candidateName,
                        interviewJD: interviewJD,
                        targetJD: targetJD,
                        matchesDescription: matchesDescription,
                        willInclude: matchesDescription && isStudentInterview
                    });
                }
                
                // Include all student interviews with matching JD (exclude templates)
                return matchesDescription && isStudentInterview;
            });

            console.log('GetStudentsByInterview: Found', matchingInterviews.length, 'matching student interviews');

            // Sort by completedAt or startedAt descending (most recent first)
            const sorted = matchingInterviews.sort((a, b) => {
                const aTime = a.completedAt ?? a.startedAt ?? 0;
                const bTime = b.completedAt ?? b.startedAt ?? 0;
                return bTime - aTime;
            });

            console.log('GetStudentsByInterview: Successfully found', sorted.length, 'students');
            if (sorted.length > 0) {
                console.log('GetStudentsByInterview: Sample students:', sorted.slice(0, 3).map(s => ({
                    id: String(s._id),
                    candidateName: s.candidateName,
                    status: s.status
                })));
            }
            return sorted;
        } catch (error: any) {
            // Log the full error for debugging
            const errorMessage = error?.message || String(error);
            const errorStack = error?.stack;
            
            console.error('GetStudentsByInterview: Full error details', {
                message: errorMessage,
                name: error?.name,
                stack: errorStack,
                interviewId: args?.interviewId,
                ownerId: args?.ownerId,
                errorType: typeof error
            });
            
            // Return empty array instead of throwing to prevent UI crashes
            // This allows the UI to continue working even if query fails
            return [];
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