import React, { useContext, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import axios from 'axios';
import { useMutation } from 'convex/react';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { api } from '@/convex/_generated/api';
import { ShareInterviewLink } from './ShareInterviewLink';
import { UserDetailContext } from '@/context/UserDetailContext';
import { toast } from 'sonner';
import {
    Check,
    GripVertical,
    Loader2,
    Plus,
    Sparkles,
    Video,
    VideoOff,
    X,
} from 'lucide-react';

type InterviewMode = 'university' | 'job';
type Step = 'mode' | 'details' | 'loading' | 'questions' | 'video';

type InterviewQuestion = {
    question: string;
    answer?: string;
};

type CreateInterviewDialogProps = {
    trigger?: React.ReactElement;
    triggerLabel?: string;
    triggerClassName?: string;
};

const UNIVERSITY_PROGRAM_TYPES = ['Undergraduate', 'Graduate', 'Masters', 'Postgraduate Diploma', 'Doctorate'];
const JOB_ROLE_TYPES = ['Internship', 'Entry Level', 'Mid Level', 'Senior', 'Leadership'];

const PROGRESS_STEPS: Array<{ id: Exclude<Step, 'loading'>; label: string }> = [
    { id: 'mode', label: 'Purpose' },
    { id: 'details', label: 'Details' },
    { id: 'questions', label: 'Questions' },
    { id: 'video', label: 'Settings' },
];

function CreateInterviewDialog({
    trigger,
    triggerLabel = '+ Create Interview',
    triggerClassName,
}: CreateInterviewDialogProps) {
    const router = useRouter();
    const { user } = useUser();
    const { userDetail, setUserDetail } = useContext(UserDetailContext);
    const saveInterviewQuestion = useMutation(api.Interview.SaveInterviewQuestion);
    const createUser = useMutation(api.users.CreateNewUser);

    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<Step>('mode');
    const [mode, setMode] = useState<InterviewMode | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        category: UNIVERSITY_PROGRAM_TYPES[0],
        description: '',
    });
    const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [videoRequired, setVideoRequired] = useState(true);
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [shareInfo, setShareInfo] = useState<{ id: string; title?: string } | null>(null);

    const currentProgressIndex = useMemo(() => {
        const active = step === 'loading' ? 'details' : step;
        return PROGRESS_STEPS.findIndex((item) => item.id === active);
    }, [step]);

    const titleLabel = mode === 'job' ? 'Role Title' : 'Program Title';
    const descriptionLabel = mode === 'job' ? 'Role Description' : 'Program Description';
    const categoryLabel = mode === 'job' ? 'Role Type' : 'Program Type';
    const placeholderTitle =
        mode === 'job' ? 'e.g. Product Designer' : 'e.g. Masters in Business Studies';
    const placeholderDescription =
        mode === 'job'
            ? 'Paste the job description or key responsibilities...'
            : 'Share what makes this course unique, admission focus, or curriculum highlights...';

    const modeOptions: Array<{
        id: InterviewMode;
        title: string;
        description: string;
    }> = [
        {
            id: 'university',
            title: 'Generate interview for University',
            description: 'Create tailored screening questions for academic programs.',
        },
        {
            id: 'job',
            title: 'Generate interview for a Job',
            description: 'Build role-specific questions for hiring workflows.',
        },
    ];

    const resetFlow = () => {
        setStep('mode');
        setMode(null);
        setFormData({
            title: '',
            category: UNIVERSITY_PROGRAM_TYPES[0],
            description: '',
        });
        setQuestions([]);
        setVideoRequired(true);
        setIsGenerating(false);
    };

    const handleOpenChange = (value: boolean) => {
        setOpen(value);
        if (!value) {
            resetFlow();
        }
    };

    const handleModeSelect = (nextMode: InterviewMode) => {
        setMode(nextMode);
        setFormData((prev) => ({
            ...prev,
            category: nextMode === 'job' ? JOB_ROLE_TYPES[0] : UNIVERSITY_PROGRAM_TYPES[0],
        }));
    };

    const handleInputChange = (field: 'title' | 'category' | 'description', value: string) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const ensureUserRecord = async () => {
        let userId = userDetail?._id;

        if (!userId && user) {
            try {
                const result = await createUser({
                    email: user.primaryEmailAddress?.emailAddress ?? '',
                    imageUrl: user.imageUrl,
                    name: user.fullName ?? '',
                });
                setUserDetail(result);
                userId = (result as any)._id || (result as any).result;
            } catch (error) {
                console.error('Error creating user:', error);
                toast.error('Failed to initialize user profile. Please refresh the page.');
                return null;
            }
        }

        if (!userId) {
            toast.error('User session not found. Please sign in again.');
            return null;
        }

        return userId as any;
    };

    const handleGenerateQuestions = async () => {
        if (!mode) {
            toast.error('Please choose how you want to use the interview.');
            return;
        }

        if (!formData.title.trim()) {
            toast.error(`Please enter the ${mode === 'job' ? 'role' : 'program'} title.`);
            return;
        }

        setIsGenerating(true);
        setStep('loading');

        try {
            const response = await axios.post('/api/generate-interview-questions', {
                programType: formData.category,
                courseTitle: formData.title,
                courseDescription: formData.description,
            });

            if (response?.data?.status === 429) {
                toast.warning(response.data.result);
                setStep('details');
                return;
            }

            if (!Array.isArray(response.data?.questions) || response.data.questions.length === 0) {
                throw new Error('No questions returned');
            }

            setQuestions(
                response.data.questions.map((item: any) => ({
                    question: item?.question ?? '',
                    answer: item?.answer ?? '',
                })),
            );
            setStep('questions');
        } catch (error) {
            console.error('Question generation failed:', error);
            if (axios.isAxiosError(error) && error.response?.data?.error) {
                toast.error(error.response.data.error);
            } else {
                toast.error('Could not generate interview questions. Please try again.');
            }
            setStep('details');
        } finally {
            setIsGenerating(false);
        }
    };

    const reorderQuestion = (from: number, to: number) => {
        if (to < 0 || to >= questions.length) return;
        setQuestions((prev) => {
            const updated = [...prev];
            const [removed] = updated.splice(from, 1);
            updated.splice(to, 0, removed);
            return updated;
        });
    };

    const handleQuestionChange = (index: number, value: string) => {
        setQuestions((prev) =>
            prev.map((item, idx) => (idx === index ? { ...item, question: value } : item)),
        );
    };

    const handleRemoveQuestion = (index: number) => {
        setQuestions((prev) => prev.filter((_, idx) => idx !== index));
    };

    const handleAddQuestion = () => {
        setQuestions((prev) => [...prev, { question: '', answer: '' }]);
    };

    const allQuestionsValid = questions.every((item) => item.question.trim().length > 0);

    const handleDragStart =
        (index: number) => (event: React.DragEvent<HTMLButtonElement>) => {
            setDraggingIndex(index);
            setDragOverIndex(null);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(index));
        };

    const handleDragEnd = () => {
        setDraggingIndex(null);
        setDragOverIndex(null);
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    };

    const handleDrop =
        (targetIndex: number) => (event: React.DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            const from = Number(event.dataTransfer.getData('text/plain'));
            if (!Number.isNaN(from) && from !== targetIndex) {
                reorderQuestion(from, targetIndex);
            }
            setDraggingIndex(null);
            setDragOverIndex(null);
        };

    const handleCreateInterview = async () => {
        if (!mode) {
            toast.error('Please complete the previous steps first.');
            return;
        }

        if (questions.length === 0 || !allQuestionsValid) {
            toast.error('Please add at least one complete question.');
            return;
        }

        const userId = await ensureUserRecord();
        if (!userId) return;

        try {
            setIsSaving(true);
            const sanitizedQuestions = questions.map((item) => ({
                question: item.question.trim(),
                answer: item.answer?.trim() ?? '',
            }));

            const displayTitle =
                mode === 'job'
                    ? `${formData.title.trim()} • ${formData.category}`
                    : `${formData.category} • ${formData.title.trim()}`;

            const interviewId = await saveInterviewQuestion({
                questions: sanitizedQuestions,
                resumeUrl: undefined,
                uid: userId,
                jobTitle: displayTitle,
                jobDescription: formData.description?.trim() || undefined,
                videoRequired,
            });

            let newId: string | undefined;
            if (typeof interviewId === 'string') {
                newId = interviewId;
            } else if (typeof interviewId === 'object' && interviewId) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                newId = interviewId._id || interviewId.id || interviewId.value;
                if (!newId && typeof (interviewId as any).toString === 'function') {
                    newId = (interviewId as any).toString();
                }
            }

            if (!newId) {
                throw new Error('Invalid interview id returned from backend');
            }

            toast.success('Interview created. Share the link or edit next.');
            setShareInfo({ id: newId, title: displayTitle });
            setShareDialogOpen(true);
            handleOpenChange(false);
        } catch (error) {
            console.error('Error saving interview:', error);
            toast.error('Failed to create interview. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const renderProgress = () => (
        <div className="flex items-center gap-2 px-4 pt-6 sm:px-8">
            {PROGRESS_STEPS.map((progressStep, index) => {
                const isActive = index <= currentProgressIndex;
                return (
                    <React.Fragment key={progressStep.id}>
                        <div
                            className={cn(
                                'flex size-2.5 items-center justify-center rounded-full transition-colors',
                                isActive ? 'bg-[#1E90FF] dark:bg-[#58B3FF]' : 'bg-gray-200 dark:bg-white/15',
                            )}
                        />
                        {index < PROGRESS_STEPS.length - 1 && (
                            <div
                                className={cn(
                                    'h-[2px] w-16 rounded-full transition-colors md:w-20',
                                    index < currentProgressIndex
                                        ? 'bg-[#1E90FF] dark:bg-[#58B3FF]'
                                        : 'bg-gray-200 dark:bg-white/15',
                                )}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );

    const baseCardClasses = cn(
        'flex flex-col gap-4 rounded-[28px] p-6 sm:p-10 shadow-xl ring-1 ring-black/5',
        'bg-white border border-transparent',
        'dark:bg-[#111214] dark:border-white/10 dark:ring-white/10 dark:shadow-none',
    );

    const contentSizeClass =
        step === 'questions'
            ? 'sm:max-w-[740px] md:max-w-[800px]'
            : 'sm:max-w-[620px] md:max-w-[680px]';

    return (
        <>
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogTrigger asChild>
                    {trigger ?? (
                        <Button type="button" className={triggerClassName}>
                            {triggerLabel}
                        </Button>
                    )}
                </DialogTrigger>
                <DialogContent
                    className={cn(
                        'w-[calc(100vw-2rem)] max-w-[95vw] border-0 bg-transparent p-0 sm:w-full',
                        contentSizeClass,
                    )}
                >
                    <div className="relative">
                        <div className="absolute inset-0 -z-10 rounded-[32px] bg-gradient-to-br from-[#BEE3FF] via-[#E6F3FF] to-[#F5FBFF] opacity-80 blur-2xl dark:from-[#0F1A2D] dark:via-[#0B1526] dark:to-[#0B1526] dark:opacity-60" />
                        <div className={cn(baseCardClasses)}>
                            {renderProgress()}
                            <DialogHeader className="px-4 sm:px-8">
                                <DialogTitle className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                                    {step === 'mode' && 'Generate Interview'}
                                    {step === 'details' && 'Share a few details'}
                                    {step === 'questions' && 'Add Questions'}
                                    {step === 'video' && 'Enable Student Video'}
                                    {step === 'loading' && 'Generating interview'}
                                </DialogTitle>
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                    {step === 'mode' &&
                                        'Choose how you’d like Matryc to tailor the interview experience.'}
                                    {step === 'details' &&
                                        'Share details about the course to generate your interview.'}
                                    {step === 'questions' &&
                                        'Edit questions at any time – drag, reorder, or add your own.'}
                                    {step === 'video' &&
                                        'Do you want the student to switch on their video?'}
                                    {step === 'loading' &&
                                        'We’re extracting interview description details just for you.'}
                                </p>
                            </DialogHeader>

                            <div className="px-4 sm:px-8">
                                {step === 'mode' && (
                                    <div className="grid gap-4">
                                        {modeOptions.map((option) => {
                                            const isSelected = mode === option.id;
                                            return (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => handleModeSelect(option.id)}
                                                    className={cn(
                                                        'flex items-center justify-between rounded-3xl border px-5 py-4 text-left transition-all',
                                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1E90FF] dark:focus-visible:ring-offset-[#111214]',
                                                        isSelected
                                                            ? 'border-transparent bg-[#1E90FF] text-white shadow-lg'
                                                            : 'border-gray-200 bg-white text-gray-900 hover:border-[#1E90FF] hover:bg-[#E6F3FF]',
                                                        !isSelected &&
                                                            'dark:border-white/10 dark:bg-[#1B1F2A] dark:text-gray-100 dark:hover:border-[#58B3FF] dark:hover:bg-[#182334]',
                                                    )}
                                                >
                                                    <div className="space-y-1.5">
                                                        <p className="text-base font-semibold">
                                                            {option.title}
                                                        </p>
                                                        <p
                                                            className={cn(
                                                                'text-sm',
                                                            isSelected ? 'text-white/90' : 'text-gray-500 dark:text-gray-400',
                                                            )}
                                                        >
                                                            {option.description}
                                                        </p>
                                                    </div>
                                                    <div
                                                        className={cn(
                                                            'flex size-6 items-center justify-center rounded-full border transition-colors',
                                                            isSelected
                                                                ? 'border-white bg-white text-[#1E90FF]'
                                                                : 'border-gray-300 text-transparent dark:border-white/20 dark:text-transparent',
                                                        )}
                                                    >
                                                        <Check className="size-4" />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {step === 'details' && (
                                    <div className="space-y-5">
                                        <div className="grid gap-2">
                                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                {titleLabel}
                                            </label>
                                            <Input
                                                value={formData.title}
                                                placeholder={placeholderTitle}
                                                onChange={(event) =>
                                                    handleInputChange('title', event.target.value)
                                                }
                                                className="h-12 rounded-2xl bg-white/90 text-sm text-gray-900 shadow-sm focus-visible:ring-[#1E90FF] dark:bg-white/5 dark:text-gray-100 dark:shadow-none"
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                {categoryLabel}
                                            </label>
                                            <div className="relative">
                                                <select
                                                    value={formData.category}
                                                    onChange={(event) =>
                                                        handleInputChange('category', event.target.value)
                                                    }
                                                    className="h-12 w-full appearance-none rounded-2xl border border-transparent bg-white/90 px-4 text-sm text-gray-900 shadow-sm focus:border-[#1E90FF] focus:outline-none focus:ring-2 focus:ring-[#1E90FF]/40 dark:bg-white/5 dark:text-gray-100 dark:border-white/10 dark:focus:border-[#58B3FF]"
                                                >
                                                    {(mode === 'job' ? JOB_ROLE_TYPES : UNIVERSITY_PROGRAM_TYPES).map(
                                                        (item) => (
                                                            <option key={item}>{item}</option>
                                                        ),
                                                    )}
                                                </select>
                                                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-400 dark:text-gray-500">
                                                    ▾
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid gap-2">
                                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                {descriptionLabel}
                                            </label>
                                            <Textarea
                                                value={formData.description}
                                                onChange={(event) =>
                                                    handleInputChange('description', event.target.value)
                                                }
                                                placeholder={placeholderDescription}
                                                className="min-h-[140px] rounded-2xl bg-white/90 text-sm text-gray-900 shadow-sm focus-visible:ring-[#1E90FF] dark:bg-white/5 dark:text-gray-100 dark:shadow-none"
                                            />
                                            <p className="text-xs text-gray-400 dark:text-gray-500">
                                                Don’t fret about formatting, we’ll take care of it.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {step === 'loading' && (
                                    <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
                                        <div className="relative flex size-20 items-center justify-center rounded-full bg-[#E6F3FF] dark:bg-[#1f2334]">
                                            <Sparkles className="size-8 text-[#1E90FF] dark:text-[#58B3FF]" />
                                            <Loader2 className="absolute size-16 animate-spin text-[#1E90FF]/30 dark:text-[#58B3FF]/20" />
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Extracting interview description details...
                                        </p>
                                    </div>
                                )}

                                {step === 'questions' && (
                                    <div className="space-y-5">
                                        <div className="rounded-full bg-gradient-to-r from-[#BEE3FF] via-[#DAECFF] to-[#F3F8FF] p-[1.5px] shadow-sm dark:from-[#162640] dark:via-[#122136] dark:to-[#122136]">
                                            <div className="flex items-center gap-3 rounded-full bg-white px-4 py-3 text-sm text-[#0F274A] dark:bg-[#111214] dark:text-[#E0E7FF]">
                                                <div className="flex size-9 items-center justify-center rounded-full bg-[#D7E7FF] text-[#1176D6] dark:bg-[#1f2f49] dark:text-[#58B3FF]">
                                                    <Sparkles className="size-4" />
                                                </div>
                                                <div className="flex flex-col leading-tight">
                                                    <span className="font-semibold">
                                                        Edit questions at any time &mdash; drag to reorder.
                                                    </span>
                                                    <span className="text-xs text-[#1E90FF] dark:text-[#58B3FF]">
                                                        Estimated interview duration: 7-9 minutes
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
                                            {questions.map((item, index) => (
                                                <div
                                                    key={`question-${index}`}
                                                    className={cn(
                                                        'flex items-start gap-3 rounded-3xl border border-gray-100 bg-white px-5 py-3.5 shadow-sm transition',
                                                        dragOverIndex === index
                                                            ? 'border-[#1E90FF]/60 shadow-md'
                                                            : 'hover:border-[#B5DAFF] hover:shadow-md',
                                                        'dark:border-white/10 dark:bg-[#111214] dark:hover:border-[#58B3FF]/40 dark:hover:shadow-lg',
                                                    )}
                                                    onDragOver={handleDragOver}
                                                    onDragEnter={() => setDragOverIndex(index)}
                                                    onDragLeave={() => setDragOverIndex(null)}
                                                    onDrop={handleDrop(index)}
                                                >
                                                    <button
                                                        type="button"
                                                        draggable
                                                        onDragStart={handleDragStart(index)}
                                                        onDragEnd={handleDragEnd}
                                                        className={cn(
                                                            'mt-1 flex size-10 items-center justify-center rounded-2xl bg-[#EAF2FB] text-gray-400 transition hover:text-[#1176D6]',
                                                            draggingIndex === index && 'bg-[#D7E7FF] text-[#1176D6]',
                                                            'dark:bg-[#1f1f2b] dark:text-gray-300 dark:hover:text-[#58B3FF]',
                                                            draggingIndex === index && 'dark:bg-[#272c3f] dark:text-[#58B3FF]',
                                                        )}
                                                        aria-label={`Reorder question ${index + 1}`}
                                                    >
                                                        <GripVertical className="size-4" />
                                                    </button>

                                                    <Textarea
                                                        value={item.question}
                                                        onChange={(event) =>
                                                            handleQuestionChange(index, event.target.value)
                                                        }
                                                        placeholder="Write question"
                                                        rows={2}
                                                        className="min-h-[48px] flex-1 resize-none border-0 bg-transparent px-0 py-2 text-[13px] leading-[1.45] text-gray-700 shadow-none focus-visible:ring-0 dark:text-gray-100"


                                                    />

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="mt-1 size-8 rounded-full text-gray-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                                                        onClick={() => handleRemoveQuestion(index)}
                                                        aria-label={`Remove question ${index + 1}`}
                                                    >
                                                        <X className="size-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>

                                        <Button
                                            type="button"
                                            onClick={handleAddQuestion}
                                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1E90FF] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1176D6] dark:bg-[#1E90FF] dark:hover:bg-[#0F6EC4]"
                                        >
                                            <Plus className="size-4" />
                                            Add question
                                        </Button>
                                    </div>
                                )}

                                {step === 'video' && (
                                    <div className="space-y-5">
                                        <div className="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-inner dark:border-white/10 dark:bg-[#111214] dark:shadow-none">
                                            <div className="relative aspect-[16/10] w-full bg-[#E6F3FF] dark:bg-[#1b1f2a]">
                                                {videoRequired ? (
                                                    <Image
                                                        src="/interview.jpg"
                                                        alt="Student video enabled"
                                                        fill
                                                        className="object-cover"
                                                        priority
                                                    />
                                                ) : (
                                                    <div className="flex h-full items-center justify-center bg-rose-50 dark:bg-rose-950/40">
                                                        <div className="flex size-20 items-center justify-center rounded-full bg-rose-100 text-rose-500 dark:bg-rose-900/60 dark:text-rose-300">
                                                            <VideoOff className="size-10" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-4 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                        Require video for this interview
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        {videoRequired
                                                            ? 'Candidates will need an active camera to proceed.'
                                                            : 'Video is optional. Candidates can join with audio only.'}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={videoRequired}
                                                    onClick={() => setVideoRequired((prev) => !prev)}
                                                    className={cn(
                                                        'inline-flex h-9 w-16 shrink-0 items-center rounded-full px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                                                        videoRequired ? 'bg-[#1E90FF]' : 'bg-gray-200',
                                                        'dark:focus-visible:ring-offset-[#111214]',
                                                        !videoRequired && 'dark:bg-white/10',
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            'flex size-7 items-center justify-center rounded-full bg-white shadow transition-transform',
                                                            videoRequired ? 'translate-x-7' : 'translate-x-0',
                                                            'dark:bg-[#F9FAFB]',
                                                        )}
                                                    >
                                                        {videoRequired ? (
                                                            <Video className="size-4 text-[#1E90FF]" />
                                                        ) : (
                                                            <VideoOff className="size-4 text-gray-400 dark:text-gray-300" />
                                                        )}
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="rounded-2xl bg-[#D7E7FF] px-5 py-3 text-xs text-[#1176D6] shadow-inner dark:bg-[#162640] dark:text-[#58B3FF] dark:shadow-none">
                                            Enable video to capture expressions, tone, and engagement. Video can still be toggled off mid-session if needed.
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-nowrap items-center justify-between gap-3 px-4 pb-2 pt-6 sm:px-8">
                                <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                                    {step !== 'mode' && (
                                        <span className="whitespace-nowrap rounded-full bg-gray-100 px-3 py-1 font-medium dark:bg-white/10 dark:text-gray-300">
                                            Step {Math.max(1, currentProgressIndex + 1)} of {PROGRESS_STEPS.length}
                                        </span>
                                    )}
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                    {step === 'mode' ? (
                                        <DialogClose asChild>
                                            <Button variant="ghost" className="rounded-full">
                                                Cancel
                                            </Button>
                                        </DialogClose>
                                    ) : (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="rounded-full"
                                            onClick={() => {
                                                if (step === 'details') {
                                                    setStep('mode');
                                                } else if (step === 'questions') {
                                                    setStep('details');
                                                } else if (step === 'video') {
                                                    setStep('questions');
                                                }
                                            }}
                                        >
                                            Back
                                        </Button>
                                    )}

                                    {step === 'mode' && (
                                        <Button
                                            type="button"
                                            className="rounded-full bg-[#1E90FF] px-6 text-sm font-semibold text-white shadow-md hover:bg-[#1176D6]"
                                            onClick={() => {
                                                if (!mode) {
                                                    toast.error('Please select one of the options.');
                                                    return;
                                                }
                                                setStep('details');
                                            }}
                                        >
                                            Next
                                        </Button>
                                    )}

                                    {step === 'details' && (
                                        <Button
                                            type="button"
                                            onClick={handleGenerateQuestions}
                                            disabled={isGenerating}
                                            className="rounded-full bg-[#1E90FF] px-6 text-sm font-semibold text-white shadow-md hover:bg-[#1176D6]"
                                        >
                                            {isGenerating && (
                                                <Loader2 className="mr-2 size-4 animate-spin text-white/80" />
                                            )}
                                            Generate
                                        </Button>
                                    )}

                                    {step === 'questions' && (
                                        <Button
                                            type="button"
                                            onClick={() => setStep('video')}
                                            disabled={!allQuestionsValid}
                                            className="rounded-full bg-[#1E90FF] px-6 text-sm font-semibold text-white shadow-md hover:bg-[#1176D6] disabled:cursor-not-allowed disabled:bg-gray-300"
                                        >
                                            Next
                                        </Button>
                                    )}

                                    {step === 'video' && (
                                        <Button
                                            type="button"
                                            onClick={handleCreateInterview}
                                            disabled={isSaving}
                                            className="rounded-full bg-[#1E90FF] px-6 text-sm font-semibold text-white shadow-md hover:bg-[#1176D6]"
                                        >
                                            {isSaving && (
                                                <Loader2 className="mr-2 size-4 animate-spin text-white/80" />
                                            )}
                                            Create interview
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {shareInfo ? (
                <ShareInterviewLink
                    interviewId={shareInfo.id}
                    jobTitle={shareInfo.title}
                    open={shareDialogOpen}
                    onOpenChange={setShareDialogOpen}
                    onContinue={() => {
                        setShareDialogOpen(false);
                        router.push(`/interview/${shareInfo.id}/edit-questions`);
                    }}
                />
            ) : null}
        </>
    );
}

export default CreateInterviewDialog;