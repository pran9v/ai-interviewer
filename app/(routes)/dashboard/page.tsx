"use client"

import { useUser } from '@clerk/nextjs';
import { useConvex } from 'convex/react';
import {
    Bell,
    CalendarClock,
    CalendarDays,
    GraduationCap,
    LayoutDashboard,
    LogOut,
    Moon,
    Plus,
    Search,
    Settings,
    Sun,
    Users,
    type LucideIcon,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import React, { useContext, useEffect, useMemo, useState } from 'react';

import { api } from '@/convex/_generated/api';
import { UserDetailContext } from '@/context/UserDetailContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import CreateInterviewDialog from '../_components/CreateInterviewDialog';
import { InterviewData } from '../interview/[interviewId]/start/page';

type NavItem = {
    label: string;
    icon: LucideIcon;
    href?: string;
    active?: boolean;
    disabled?: boolean;
};

const navItems: NavItem[] = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', active: true },
];

const PRIMARY_COLOR = '#1E90FF';
    const SIDEBAR_GRADIENT = 'radial-gradient(120% 120% at 50% -30%, rgba(133, 200, 255, 0.55) 0%, rgba(255, 255, 255, 0.9) 55%)';

type StatCardProps = {
    icon: LucideIcon;
    accent: string;
    title: string;
    value: string;
    caption: string;
    dark?: boolean;
};

const StatCard = ({ icon: Icon, accent, title, value, caption, dark = false }: StatCardProps) => (
    <div
        className={cn(
            'relative overflow-hidden rounded-3xl p-6 transition hover:-translate-y-0.5',
            dark
                ? 'border border-white/10 bg-[#0F0F0F] text-gray-100 hover:shadow-lg hover:shadow-black/30'
                : 'border border-white/60 bg-white/90 text-gray-900 shadow-xl hover:shadow-2xl backdrop-blur-sm',
        )}
    >
        <div className="flex items-start justify-between gap-6">
            <div className="flex flex-col gap-4">
                <div
                    className="inline-flex size-12 items-center justify-center rounded-2xl text-base"
                    style={{ backgroundColor: `${accent}1A`, color: accent }}
                >
                    <Icon className="size-5" />
                </div>
                <span className={cn('text-xs font-medium uppercase tracking-wide', dark ? 'text-gray-400' : 'text-gray-400')}>
                    {title}
                </span>
                <span className={cn('text-3xl font-semibold', dark ? 'text-gray-100' : 'text-gray-900')}>{value}</span>
                <span className={cn('text-xs', dark ? 'text-gray-400' : 'text-gray-500')}>{caption}</span>
            </div>
        </div>
        <div
            className="pointer-events-none absolute -right-10 -top-10 size-24 rounded-full opacity-10"
            style={{ backgroundColor: accent }}
        />
    </div>
);

const formatCompactNumber = (value: number) => {
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k`;
    }
    return value.toString();
};

const formatRelativeTime = (timestamp?: number | null) => {
    if (!timestamp) return 'Awaiting kickoff';
    const diff = Date.now() - timestamp;
    if (diff <= 0) return 'Just now';

    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'Just now';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;

    const months = Math.floor(days / 30);
    if (months < 12) return `${months} mo${months === 1 ? '' : 's'} ago`;

    const years = Math.floor(months / 12);
    return `${years} yr${years === 1 ? '' : 's'} ago`;
};

const getInitials = (name: string) => {
    return (
        name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? '')
            .join('') || 'U'
    );
};

function Dashboard() {
    const { user, isLoaded: isUserLoaded } = useUser();
    const { userDetail } = useContext(UserDetailContext);
    const convex = useConvex();

    const [interviewList, setInterviewList] = useState<InterviewData[]>([]);
    const [loading, setLoading] = useState(true);
    const [themeChoice, setThemeChoice] = useState<'light' | 'dark'>('light');
    const isDark = themeChoice === 'dark';

    useEffect(() => {
        if (typeof document === 'undefined') return;
        const root = document.documentElement;

        if (isDark) {
            root.classList.add('dark');
            root.style.setProperty('--background', '#000000');
            root.style.setProperty('--foreground', '#FFFFFF');
        } else {
            root.classList.remove('dark');
            root.style.removeProperty('--background');
            root.style.removeProperty('--foreground');
        }

        return () => {
            root.classList.remove('dark');
            root.style.removeProperty('--background');
            root.style.removeProperty('--foreground');
        };
    }, [isDark]);

    const userId = userDetail?._id;

    useEffect(() => {
        if (!userId) {
            if (isUserLoaded) {
            setLoading(false);
            }
            return;
        }

        const fetchInterviews = async () => {
        setLoading(true);
        try {
            const result = await convex.query(api.Interview.GetInterviewList, {
                    uid: userId as any, // TODO: narrow Convex type
            });
                setInterviewList((result ?? []) as InterviewData[]);
        } catch (error) {
            console.error('Error fetching interview list:', error);
            } finally {
        setLoading(false);
    }
        };

        fetchInterviews();
    }, [convex, userId, isUserLoaded]);

    const fullName = userDetail?.name ?? user?.fullName ?? 'Your profile';
    const greetingName = (userDetail?.name ?? user?.firstName ?? user?.fullName ?? 'there').split(' ')[0];
    const avatarUrl = userDetail?.imageUrl ?? user?.imageUrl ?? '';
    const initials = getInitials(fullName);

    const sortedInterviews = useMemo(() => {
        return [...interviewList].sort((a, b) => {
            const aTime = a.completedAt ?? a.startedAt ?? 0;
            const bTime = b.completedAt ?? b.startedAt ?? 0;
            return bTime - aTime;
        });
    }, [interviewList]);

    const candidatePreviews = useMemo(() => sortedInterviews.slice(0, 4), [sortedInterviews]);
    const highlightedInterviews = useMemo(() => sortedInterviews.slice(0, 6), [sortedInterviews]);

    const activeInterviewCount = useMemo(
        () => interviewList.filter((item) => item.status === 'in_progress').length,
        [interviewList],
    );
    const candidateCount = interviewList.length;

    const pageClasses = cn(
        'min-h-screen pb-12 pt-10 transition-colors duration-300 font-sans',
        isDark ? 'bg-black text-white' : 'bg-white text-gray-900',
    );
    const containerClasses = cn(
        'mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 md:px-8 lg:flex-row lg:px-12',
        isDark
            ? ''
            : 'rounded-[30px] bg-white/90 backdrop-blur-xl border border-white/50',
    );
    const sidebarClasses = cn(
        'hidden w-full max-w-[240px] shrink-0 flex-col gap-8 rounded-[26px] p-6 transition-colors duration-300 lg:flex',
        isDark
            ? 'bg-[#0F0F0F] text-gray-100 border border-white/10 shadow-none'
            : 'text-gray-900 shadow-xl ring-1 ring-white/30',
    );
    const sidebarStyle = !isDark ? { background: SIDEBAR_GRADIENT } : undefined;
    const profileCardClasses = cn(
        'rounded-2xl p-4 transition-colors duration-300',
        isDark
            ? 'bg-[#1A1A1A] border border-white/10'
            : 'bg-white/90 border border-[#C7E6FF] shadow-[0_12px_30px_rgba(30,144,255,0.12)]',
    );
    const sidebarNoteClasses = cn(
        'rounded-2xl p-4 text-xs transition-colors duration-300',
        isDark
            ? 'bg-[#1A1A1A] text-gray-300 border border-white/10'
            : 'bg-white text-gray-600 border border-[#D4E9FF] shadow-[0_10px_28px_rgba(30,144,255,0.1)]',
    );
    const mobileHeaderClasses = cn(
        'rounded-3xl p-5 shadow-sm transition-colors duration-300 lg:hidden',
        isDark ? 'bg-[#0F0F0F] border border-white/10 shadow-none' : 'bg-white/90 shadow-lg',
    );
    const heroStyle = !isDark
        ? {
              background:
                  'radial-gradient(120% 120% at 0% 0%, rgba(133, 200, 255, 0.55) 0%, rgba(255, 255, 255, 0.9) 55%)',
          }
        : undefined;

    return (
        <div className={pageClasses}>
            <div className={containerClasses}>
                <aside className={sidebarClasses} style={sidebarStyle}>
                    <div className={cn("flex items-center gap-3", isDark ? "text-white" : "text-[#1E90FF]")}>
                        <Image src="/logo.svg" alt="Matryc" width={36} height={36} priority />
                        <span className="text-xl font-semibold tracking-tight">Matryc</span>
                    </div>

                    <div className={profileCardClasses}>
                        <div className="flex items-center gap-3">
                            <div
                                className={cn(
                                    'size-12 overflow-hidden rounded-2xl text-base font-semibold transition-colors duration-300 border',
                                    isDark
                                        ? 'bg-white/10 text-white border-white/10'
                                        : 'bg-white text-[#1E90FF] border-white/40 shadow-sm',
                                )}
                            >
                                {avatarUrl ? (
                                    <Image
                                        src={avatarUrl}
                                        alt={fullName}
                                        width={48}
                                        height={48}
                                        className="size-full object-cover"
                                        unoptimized
                                    />
                                ) : (
                                    <div className="flex size-full items-center justify-center">{initials}</div>
                                )}
                            </div>
                            <div className="flex flex-col">
                                <span className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>{fullName}</span>
                                <span className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>Program Coordinator</span>
                            </div>
                        </div>
                    </div>

                    <nav className="flex flex-col gap-2">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const navClass = cn(
                                'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors duration-300',
                                item.active
                                    ? isDark
                                        ? 'bg-white/10 text-white'
                                        : 'bg-white text-[#1E90FF] shadow-md'
                                    : isDark
                                        ? 'text-gray-400 hover:bg-white/5 hover:text-white'
                                        : 'text-gray-500 hover:bg-white/50 hover:text-gray-900',
                                item.disabled && 'cursor-not-allowed opacity-60',
                            );

                            const content = (
                                <div className={navClass}>
                                    <Icon className="size-4" />
                                    <span>{item.label}</span>
                                </div>
                            );

                            if (item.href && !item.disabled) {
                                return (
                                    <Link key={item.label} href={item.href} className="no-underline">
                                        {content}
                                    </Link>
                                );
                            }

                            return (
                                <div key={item.label} aria-disabled={item.disabled}>
                                    {content}
                                </div>
                            );
                        })}
                    </nav>

                    <div className="mt-auto flex flex-col gap-4">
                        <div className={sidebarNoteClasses}>
                            Manage interviews and candidates seamlessly with Matryc.
                        </div>
                        <Button
                            variant="ghost"
                            className={cn(
                                'flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-colors duration-300',
                                isDark
                                    ? 'bg-white/5 text-red-300 hover:bg-white/10'
                                    : 'bg-white text-[#1E90FF] border border-[#B5DAFF] shadow-sm hover:bg-[#F1F7FF]',
                            )}
                        >
                            <LogOut className="size-4" />
                            Log out
                        </Button>
                    </div>
                </aside>

                <main className="flex-1">
                    <div className="flex flex-col gap-6">
                        <div className={mobileHeaderClasses}>
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <Image src="/logo.svg" alt="Matryc" width={32} height={32} priority />
                                    <div className="flex flex-col">
                                        <span className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>Hello</span>
                                        <span className={cn('text-base font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                                            {fullName}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    className={cn(
                                        'rounded-full px-4 py-2 text-xs font-semibold transition-colors duration-300',
                                        isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white text-[#1E90FF] shadow-md hover:bg-[#E6F3FF]',
                                    )}
                                >
                                    <LayoutDashboard className="mr-2 size-4" />
                                    Dashboard
                                </Button>
                            </div>
                            {navItems.length > 1 && (
                                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                                    {navItems.map((item) => {
                                        const Icon = item.icon;
                                        return (
                                            <div
                                                key={`${item.label}-mobile`}
                                                className={cn(
                                                    'flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-colors duration-300',
                                                    item.active
                                                        ? isDark
                                                            ? 'bg-white/10 text-white'
                                                            : 'bg-[#1E90FF] text-white shadow-md'
                                                        : isDark
                                                            ? 'bg-white/5 text-gray-400'
                                                            : 'bg-white/70 text-[#1E90FF]',
                                                )}
                                            >
                                                <Icon className="size-4" />
                                                <span>{item.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="relative w-full lg:max-w-sm">
                                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                                <Input
                                    type="search"
                                    placeholder="Search interviews or candidates"
                                    className={cn(
                                        'h-12 rounded-full border-0 pl-11 pr-4 text-sm shadow-sm ring-1 ring-transparent transition-colors duration-300 focus:border-transparent focus-visible:ring-2 focus-visible:ring-[#1E90FF]/40',
                                        isDark
                                            ? 'bg-white/10 text-gray-200 placeholder:text-gray-500'
                                            : 'bg-white text-gray-600',
                                    )}
                                />
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                                <div className="flex w-full items-center gap-3 overflow-x-auto pb-1 sm:w-auto sm:justify-end sm:overflow-visible">
                                    <div
                                        className={cn(
                                            'flex shrink-0 items-center gap-2 rounded-full p-1 shadow-sm transition-colors duration-300',
                                            isDark ? 'border border-white/10 bg-white/10 shadow-none' : 'bg-white/85 border border-white/60 shadow-lg',
                                        )}
                                    >
                                    <button
                                        type="button"
                                        onClick={() => setThemeChoice('light')}
                                        className={cn(
                                            'flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition',
                                            !isDark
                                            ? 'bg-[#1E90FF] text-white shadow'
                                                : 'text-gray-400 hover:bg-white/10',
                                        )}
                                    >
                                        <Sun className="size-4" />
                                        <span className="hidden md:inline">Light</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setThemeChoice('dark')}
                                        className={cn(
                                            'flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition',
                                            isDark
                                            ? 'bg-[#1E90FF] text-white shadow'
                                            : 'text-[#1E90FF] hover:bg-[#E6F3FF]',
                                        )}
                                    >
                                        <Moon className="size-4" />
                                        <span className="hidden md:inline">Dark</span>
                                    </button>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={cn(
                                            'size-11 shrink-0 rounded-full border text-gray-500 shadow-sm transition-colors duration-300',
                                            isDark
                                                ? 'border-white/10 bg-white/10 text-gray-300 hover:bg-white/20'
                                                : 'border-transparent bg-white hover:border-[#BEE3FF] hover:text-[#1E90FF]',
                                        )}
                                    >
                                        <Bell className="size-5" />
                                    </Button>

                                    <CreateInterviewDialog
                                        trigger={
                                            <Button className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#1E90FF] px-5 text-sm font-semibold text-white shadow-md hover:bg-[#1176D6] sm:flex-none">
                                                <span className="whitespace-nowrap">New Interview</span>
                                                <Plus className="size-4" />
                                            </Button>
                                        }
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                            <div className="flex flex-col gap-6">
                                <section
                                    className={cn(
                                        'relative overflow-hidden rounded-3xl p-6 sm:p-8 transition-colors duration-300',
                                        isDark
                                            ? 'bg-gradient-to-r from-[#111111] to-black border border-white/10 shadow-none'
                                            : 'border border-white/50 shadow-xl',
                                    )}
                                    style={heroStyle}
                                >
                                    {!isDark && (
                                        <>
                                            <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[#85C8FF]/40 blur-3xl" />
                                            <div className="pointer-events-none absolute -bottom-16 -left-12 h-48 w-48 rounded-full bg-[#1E90FF]/20 blur-3xl" />
                                        </>
                                    )}
                                    <div className="relative z-10">
                                        <p className={cn('text-sm', isDark ? 'text-gray-300' : 'text-gray-600')}>
                                            Hello 👋, {greetingName}
                                        </p>
                                        <h1
                                            className={cn(
                                                'mt-2 text-3xl font-semibold',
                                                isDark ? 'text-white' : 'text-gray-900',
                                            )}
                                        >
                                            Let's make your interviews stand out
                                        </h1>
                                        <p className={cn('mt-4 max-w-xl text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
                                            Track candidate progress, manage interview schedules, and review performance insights — all
                                            in one beautiful workspace.
                                        </p>
                                    </div>
                                </section>

                                <section className="grid gap-4 sm:grid-cols-2">
                                    <StatCard
                                        icon={CalendarClock}
                                        accent={PRIMARY_COLOR}
                                        title="Interview"
                                        value={formatCompactNumber(activeInterviewCount)}
                                        caption="No of active interviews"
                                        dark={isDark}
                                    />
                                    <StatCard
                                        icon={Users}
                                        accent="#F97316"
                                        title="Candidates"
                                        value={formatCompactNumber(candidateCount)}
                                        caption="Total no of candidates"
                                        dark={isDark}
                                    />
                                </section>

                                <section
                                    className={cn(
                                        'rounded-3xl p-6 transition-colors duration-300',
                                        isDark
                                            ? 'bg-[#0F0F0F] border border-white/10 shadow-none'
                                            : 'bg-white/90 border border-white/60 shadow-xl backdrop-blur-sm',
                                    )}
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <h3 className={cn('text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                                            Latest Candidates
                                        </h3>
                                        <Button
                                            variant="ghost"
                                            className={cn(
                                                'h-auto px-0 text-sm font-semibold hover:bg-transparent',
                                                isDark ? 'text-[#A5B4FF]' : 'text-[#1E90FF]',
                                            )}
                                        >
                                            View all
                                        </Button>
                                    </div>

                                    <div className="mt-6 space-y-4">
                                        {loading
                                            ? Array.from({ length: 4 }).map((_, index) => (
                                                  <div
                                                      key={`candidate-skeleton-${index}`}
                                                      className={cn(
                                                          'flex items-center justify-between gap-4 rounded-2xl border p-4 transition-colors duration-300',
                                                          isDark
                                                              ? 'border-white/10 bg-[#1A1A1A]'
                                                              : 'border-[#D7E7FF] bg-[#F3F8FF]',
                                                      )}
                                                  >
                                                      <div className="flex-1 space-y-2">
                                                          <Skeleton className="h-4 w-32" />
                                                          <Skeleton className="h-3 w-48" />
                                                      </div>
                                                      <Skeleton className="h-9 w-20 rounded-full" />
                                                  </div>
                                              ))
                                            : candidatePreviews.length > 0
                                              ? candidatePreviews.map((interview, idx) => (
                                                    <div
                                                        key={String(interview._id)}
                                                        className={cn(
                                                            'flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 transition hover:shadow-sm',
                                                            isDark
                                                                ? 'border-white/10 bg-[#1A1A1A] hover:shadow-black/20'
                                                                : 'border-[#D7E7FF] bg-[#F3F8FF]',
                                                        )}
                                                    >
                                                        <div className="min-w-0 flex-1">
                                                            <p className={cn('truncate text-sm font-semibold', isDark ? 'text-gray-100' : 'text-gray-900')}>
                                                                {interview.jobTitle ?? `Candidate ${idx + 1}`}
                                                            </p>
                                                            <p className={cn('mt-1 line-clamp-1 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                                                                {interview.jobDescription ?? 'No description provided yet.'}
                                                            </p>
                                                        </div>
                                                        <Link href={`/interview/${interview._id}`}>
                                                            <Button
                                                                variant="outline"
                                                                className={cn(
                                                                    'rounded-full px-5 py-2 text-sm font-semibold transition-colors duration-300',
                                                                    isDark
                                                                        ? 'border-white/30 text-white hover:bg-white/10'
                                                                        : 'border-[#1E90FF] text-[#1E90FF] hover:bg-[#E6F3FF]',
                                                                )}
                                                            >
                                                                Open
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                ))
                                              : (
                                                  <div
                                                      className={cn(
                                                          'rounded-2xl border border-dashed p-10 text-center text-sm transition-colors duration-300',
                                                          isDark
                                                              ? 'border-white/20 bg-[#121212] text-gray-400'
                                                          : 'border-[#D7E7FF] bg-[#F3F8FF] text-gray-500',
                                                      )}
                                                  >
                                                      No candidates yet. Start by creating a new interview.
                                                  </div>
                                              )}
                                    </div>
                                </section>
                            </div>

                            <section
                                className={cn(
                                    'rounded-3xl p-6 transition-colors duration-300',
                                    isDark
                                        ? 'bg-[#0F0F0F] border border-white/10 shadow-none'
                                        : 'bg-white/90 border border-white/60 shadow-xl backdrop-blur-sm',
                                )}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className={cn('text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                                            Your Interview
                                        </h3>
                                        <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                                            Track ongoing and recent interview sessions
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={cn('hidden text-xs sm:inline', isDark ? 'text-gray-500' : 'text-gray-400')}>
                                            Last month
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn(
                                                'rounded-full border text-gray-500 transition-colors duration-300',
                                                isDark
                                                    ? 'border-white/10 bg-white/10 hover:bg-white/20'
                                                    : 'border-[#D8E9FF] bg-white hover:bg-[#E6F3FF]',
                                            )}
                                        >
                                            <CalendarDays className="size-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                                    {loading
                                        ? Array.from({ length: 4 }).map((_, index) => (
                                              <div
                                                  key={`interview-skeleton-${index}`}
                                                  className={cn(
                                                      'rounded-2xl border p-4 transition-colors duration-300',
                                                      isDark ? 'border-white/10 bg-[#1A1A1A]' : 'border-gray-100 bg-white',
                                                  )}
                                              >
                                                  <Skeleton className="h-4 w-40" />
                                                  <Skeleton className="mt-2 h-3 w-24" />
                                                  <div className="mt-4 flex items-center justify-between">
                                                      <Skeleton className="h-8 w-20 rounded-full" />
                                                      <Skeleton className="h-3 w-16" />
                                                  </div>
                                              </div>
                                          ))
                                        : highlightedInterviews.length > 0
                                          ? highlightedInterviews.map((interview) => (
                                                <div
                                                    key={String(interview._id)}
                                                    className={cn(
                                                        'flex flex-col gap-3 rounded-2xl border p-4 transition',
                                                        isDark
                                                            ? 'border-white/10 bg-[#1A1A1A] hover:border-white/20 hover:shadow-black/20'
                                                                : 'border-[#D7E7FF] bg-[#F3F8FF] hover:border-[#BEE3FF] hover:shadow-sm',
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <h4 className={cn('line-clamp-2 text-sm font-semibold', isDark ? 'text-gray-100' : 'text-gray-900')}>
                                                            {interview.jobTitle ?? 'Untitled Interview'}
                                                        </h4>
                                                        {interview.status && (
                                                            <span
                                                                className={cn(
                                                                    'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize',
                                                                    interview.status === 'completed'
                                                                        ? isDark
                                                                            ? 'bg-emerald-500/20 text-emerald-300'
                                                                            : 'bg-[#DCFCE7] text-[#15803D]'
                                                                        : interview.status === 'in_progress'
                                                                            ? isDark
                                                                                ? 'bg-[#1E90FF]/30 text-[#A5B4FF]'
                                                                                : 'bg-[#E1F0FF] text-[#1E90FF]'
                                                                            : isDark
                                                                                ? 'bg-rose-500/20 text-rose-300'
                                                                                : 'bg-[#FFE4E6] text-[#BE123C]',
                                                                )}
                                                            >
                                                                {interview.status.replace('_', ' ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                                                        {interview.jobDescription
                                                            ? `${interview.jobDescription.slice(0, 80)}${
                                                                  interview.jobDescription.length > 80 ? '…' : ''
                                                              }`
                                                            : 'No description available yet.'}
                                                    </p>
                                                    <div className="mt-auto flex items-center justify-between">
                                                        <Link
                                                            href={`/interview/${interview._id}`}
                                                            className={cn(
                                                                'text-sm font-semibold transition-colors duration-300 hover:underline',
                                                                isDark ? 'text-[#A5B4FF]' : 'text-[#1E90FF]',
                                                            )}
                                                        >
                                                            Open
                                                        </Link>
                                                        <span className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                                                            {formatRelativeTime(interview.completedAt ?? interview.startedAt)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))
                                          : (
                                              <div
                                                  className={cn(
                                                      'col-span-full rounded-2xl border border-dashed p-10 text-center text-sm transition-colors duration-300',
                                                      isDark
                                                          ? 'border-white/20 bg-[#121212] text-gray-400'
                                                      : 'border-[#D7E7FF] bg-[#F3F8FF] text-gray-500',
                                                  )}
                                              >
                                                  No interviews yet. Create one to get started.
                                              </div>
                                          )}
                                </div>
                            </section>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

export default Dashboard;