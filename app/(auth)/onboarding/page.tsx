'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSignUp, useSignIn, useUser } from '@clerk/nextjs'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Building2, Users, Check, Loader2, User, Lock, Upload, ArrowRight } from 'lucide-react'

type RecruiterType = 'recruitment-team' | 'recruitment-agency' | null
type AuthMode = 'signup' | 'signin'

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp()
  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn()
  const { user, isSignedIn, isLoaded: userLoaded } = useUser()
  const [authMode, setAuthMode] = useState<AuthMode>('signup')
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const profileComplete = Boolean(
    user?.unsafeMetadata?.recruiterType &&
      user?.unsafeMetadata?.universityName &&
      user?.unsafeMetadata?.universityWebsite
  )

  // Check URL params for auth mode
  useEffect(() => {
    const mode = searchParams?.get('mode')
    if (mode === 'signin') {
      setAuthMode('signin')
    }
  }, [searchParams])

  // If user already has a session, decide where to go
  useEffect(() => {
    if (!userLoaded || !isSignedIn) return

    if (profileComplete) {
      router.replace('/dashboard')
      return
    }

    // Signed-in users without profile details should continue onboarding
    setAuthMode('signup')
    setStep((prev) => (prev < 2 ? 2 : prev))
  }, [userLoaded, isSignedIn, profileComplete, router])
  
  // Form data
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [recruiterType, setRecruiterType] = useState<RecruiterType>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [pendingVerification, setPendingVerification] = useState(false)
  
  // University data
  const [universityWebsite, setUniversityWebsite] = useState('')
  const [universityName, setUniversityName] = useState('')
  const [universityLogo, setUniversityLogo] = useState('')
  const [universityAbout, setUniversityAbout] = useState('')
  const [websiteValid, setWebsiteValid] = useState(false)

  // Validate password format
  const validatePassword = (pwd: string): { isValid: boolean; message: string } => {
    if (!pwd || pwd.length < 8) {
      return {
        isValid: false,
        message: 'Password must be at least 8 characters long'
      }
    }
    if (!/[A-Z]/.test(pwd)) {
      return {
        isValid: false,
        message: 'Password must contain at least one uppercase letter'
      }
    }
    if (!/[a-z]/.test(pwd)) {
      return {
        isValid: false,
        message: 'Password must contain at least one lowercase letter'
      }
    }
    if (!/[0-9]/.test(pwd)) {
      return {
        isValid: false,
        message: 'Password must contain at least one number'
      }
    }
    return { isValid: true, message: '' }
  }

  // Validate website URL
  const validateWebsite = (url: string) => {
    const urlPattern = /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?$/
    const isValid = urlPattern.test(url)
    setWebsiteValid(isValid)
    return isValid
  }

  // Handle website input change
  const handleWebsiteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setUniversityWebsite(value)
    validateWebsite(value)
  }

  // Sign In handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSignedIn) {
      router.replace('/dashboard')
      return
    }
    if (!signInLoaded) return
    setLoading(true)
    try {
      const result = await signIn?.create({ identifier: email, password })
      if (result?.status === 'complete') {
        await setActiveSignIn({ session: result.createdSessionId })
        router.push('/dashboard')
      }
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  // Sign Up handler
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSignedIn) {
      router.replace('/dashboard')
      return
    }
    if (!signUpLoaded) return
    if (!agreeToTerms) {
      toast.error('Please agree to the terms & privacy policy')
      return
    }
    
    // Validate password format before submitting
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      toast.error(passwordValidation.message)
      return
    }
    
    setLoading(true)
    try {
      await signUp?.create({ emailAddress: email, password })
      await signUp?.prepareEmailAddressVerification({ strategy: 'email_code' })
      setPendingVerification(true)
      toast.success('Verification code sent to your email!')
    } catch (err: any) {
      // Parse Clerk error messages and show appropriate user-friendly messages
      const errorMessage = err.errors?.[0]?.message || ''
      let userFriendlyMessage = 'Failed to create account'
      
      // Check for specific error types
      if (errorMessage.includes('password') || errorMessage.includes('Password')) {
        // Check if it's a format issue or breach issue
        if (errorMessage.toLowerCase().includes('breach') || errorMessage.toLowerCase().includes('data breach')) {
          userFriendlyMessage = 'For your account security, please choose a different password.'
        } else if (errorMessage.toLowerCase().includes('too short') || errorMessage.toLowerCase().includes('minimum')) {
          userFriendlyMessage = 'Password must be at least 8 characters long'
        } else if (errorMessage.toLowerCase().includes('uppercase')) {
          userFriendlyMessage = 'Password must contain at least one uppercase letter'
        } else if (errorMessage.toLowerCase().includes('lowercase')) {
          userFriendlyMessage = 'Password must contain at least one lowercase letter'
        } else if (errorMessage.toLowerCase().includes('number') || errorMessage.toLowerCase().includes('digit')) {
          userFriendlyMessage = 'Password must contain at least one number'
        } else if (errorMessage.toLowerCase().includes('special') || errorMessage.toLowerCase().includes('symbol')) {
          userFriendlyMessage = 'Password must contain at least one special character'
        } else {
          // Generic password format error
          userFriendlyMessage = 'Password does not meet requirements. Please ensure your password is at least 8 characters long and contains uppercase, lowercase, and numbers.'
        }
      } else if (errorMessage.includes('email')) {
        userFriendlyMessage = errorMessage
      } else {
        userFriendlyMessage = errorMessage || 'Failed to create account'
      }
      
      toast.error(userFriendlyMessage)
    } finally {
      setLoading(false)
    }
  }

  // Email verification handler
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signUpLoaded) return
    
    // Validate code format before submitting
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a valid 6-digit verification code')
      return
    }
    
    setLoading(true)
    try {
      const completeSignUp = await signUp?.attemptEmailAddressVerification({ code: verificationCode })
      if (completeSignUp?.status === 'complete') {
        await setActiveSignUp({ session: completeSignUp.createdSessionId })
        if (firstName || lastName) {
          try {
            await completeSignUp.update({ firstName: firstName || undefined, lastName: lastName || undefined })
          } catch (updateErr) { }
        }
        setStep(2)
        setPendingVerification(false)
        toast.success('Email verified! Please select your role.')
      }
    } catch (err: any) {
      // Parse Clerk error messages and show user-friendly messages
      const errorMessage = err.errors?.[0]?.message || ''
      const errorCode = err.errors?.[0]?.code || ''
      const fullErrorText = `${errorMessage} ${errorCode}`.toLowerCase()
      
      let userFriendlyMessage = 'Invalid verification code'
      
      // Check for specific error types
      if (fullErrorText.includes('expired') || fullErrorText.includes('expire')) {
        userFriendlyMessage = 'This verification code has expired. Please request a new code.'
      } else if (fullErrorText.includes('invalid') || fullErrorText.includes('incorrect') || fullErrorText.includes('wrong')) {
        userFriendlyMessage = 'The verification code you entered is incorrect. Please check and try again.'
      } else if (fullErrorText.includes('already used') || fullErrorText.includes('already verified')) {
        userFriendlyMessage = 'This verification code has already been used. Please request a new code.'
      } else if (fullErrorText.includes('too many') || fullErrorText.includes('attempts') || fullErrorText.includes('rate limit')) {
        userFriendlyMessage = 'Too many verification attempts. Please wait a moment and request a new code.'
      } else if (fullErrorText.includes('not found') || fullErrorText.includes('does not exist')) {
        userFriendlyMessage = 'Verification code not found. Please request a new code.'
      } else if (errorMessage) {
        // Use the original message if it's already user-friendly
        userFriendlyMessage = errorMessage
      }
      
      toast.error(userFriendlyMessage)
    } finally {
      setLoading(false)
    }
  }

  // Recruiter type selection handler
  const handleRecruiterTypeSelection = (type: RecruiterType) => {
    setRecruiterType(type)
    setStep(3)
    toast.success('Great! Now let\'s set up your university details.')
  }

  // University website submission handler
  const handleUniversityWebsite = () => {
    if (!websiteValid || !universityWebsite) {
      toast.error('Please enter a valid website URL')
      return
    }
    setStep(4)
  }

  // Final university details submission handler
  const handleUniversityDetails = async () => {
    if (!universityName) {
      toast.error('Please enter your university name')
      return
    }
    setLoading(true)
    try {
      if (user) {
        await user.update({
          unsafeMetadata: {
            recruiterType,
            universityWebsite: `https://${universityWebsite}`,
            universityName,
            universityLogo,
            universityAbout
          }
        })
        toast.success('Profile setup complete!')
        router.push('/dashboard')
      } else {
        throw new Error('User not authenticated')
      }
    } catch (err: any) {
      toast.error('Failed to save profile information')
    } finally {
      setLoading(false)
    }
  }

  // Google OAuth handler
  const handleGoogleSignIn = async () => {
    if (isSignedIn) {
      router.replace('/dashboard')
      return
    }
    const targetLoaded = authMode === 'signin' ? signInLoaded : signUpLoaded
    if (!targetLoaded) {
      toast.message?.('Still loading, please try again in a moment')
      return
    }

    setGoogleLoading(true)
    const dashboardRedirect = '/dashboard'
    const onboardingRedirect = '/onboarding?mode=signup'
    const redirectUrl =
      authMode === 'signin'
        ? `/sso-callback?redirect_url=${encodeURIComponent(dashboardRedirect)}`
        : `/sso-callback?redirect_url=${encodeURIComponent(onboardingRedirect)}`

    try {
      if (authMode === 'signin') {
        void signIn?.authenticateWithRedirect({
          strategy: 'oauth_google',
          redirectUrl,
          redirectUrlComplete: dashboardRedirect,
        })
      } else {
        void signUp?.authenticateWithRedirect({
          strategy: 'oauth_google',
          redirectUrl,
          redirectUrlComplete: onboardingRedirect,
        })
      }
    } catch (err: any) {
      toast.error('Failed to sign in with Google')
      setGoogleLoading(false)
    }
  }

  // Visual Step Logic
  // Step 1: Auth (step 1)
  // Step 2: Recruiter Type (step 2)
  // Step 3: University Info (step 3 & 4)
  const visualStep = step === 1 ? 1 : step === 2 ? 2 : 3

  if (!userLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    )
  }

  if (isSignedIn && profileComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 lg:p-8" style={{
      background: 'linear-gradient(135deg, #99C2FF 0%, #ffffff 50%, #99C2FF 100%)'
    }}>
      <div className="w-full max-w-[900px] bg-white rounded-[30px] shadow-2xl overflow-hidden flex flex-col lg:flex-row min-h-[600px]">
        
        {/* Left Panel */}
        <div className="hidden lg:flex lg:w-[50%] bg-white p-3 flex-col">
          <div className="flex-1 rounded-[24px] p-8 text-white relative flex flex-col justify-end gap-8 overflow-hidden" 
            style={{ 
              background: 'radial-gradient(70% 70% at 50% 30%, #85C8FF 0%, #1E90FF 100%)' 
            }}>
            <div className="relative z-10">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-sm font-medium mb-6">
                  <span className="animate-pulse">✨</span>
                  Join us to Interview
                </div>
                
                <h1 className="text-4xl font-bold mb-6 leading-tight">
                  Start your Journey
                </h1>
                
                <p className="text-lg text-white/90 leading-relaxed">
                  Follow these simple steps to set up your account.
                </p>
              </motion.div>
            </div>

            {/* Steps Indicator */}
            <div className="flex gap-3 relative z-10 w-full">
              {[
                { num: 1, title: 'Register your account' },
                { num: 2, title: 'Set up your profile Information' },
                { num: 3, title: 'Enter Details' }
              ].map((item) => (
                <div
                  key={item.num}
                  className={`flex flex-col justify-between p-3 rounded-2xl transition-all flex-1 aspect-square ${
                    visualStep === item.num 
                      ? 'bg-white text-gray-900' 
                      : 'bg-white/10 border border-white/20 text-white'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    visualStep === item.num
                      ? 'bg-[#1E90FF] text-white'
                      : 'border border-white/40 text-white'
                  }`}>
                    {item.num}
                  </div>
                  <span className="font-semibold text-[13px] leading-tight mt-1">
                    {item.title}
                  </span>
                </div>
              ))}
            </div>

            {/* Decorative blobs */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/30 rounded-full translate-y-48 -translate-x-48 blur-3xl" />
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-full lg:w-[50%] p-6 lg:p-8 flex flex-col justify-center relative">
          <AnimatePresence mode="wait">
            {/* Step 1: Sign Up / Sign In */}
            {step === 1 && !pendingVerification && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-md mx-auto w-full"
              >
                <h2 className="text-[32px] font-bold text-gray-900 mb-6">
                  {authMode === 'signup' ? 'Get Started Now' : 'Welcome Back'}
                </h2>
                
                {/* Google Sign In */}
                <div className="mb-6">
                  <Button
                    variant="outline"
                    className="w-full h-12 rounded-full border-gray-200 hover:bg-gray-50 text-gray-700 font-medium text-sm relative"
                    onClick={handleGoogleSignIn}
                    type="button"
                    disabled={googleLoading || (authMode === 'signin' ? !signInLoaded : !signUpLoaded)}
                  >
                    <div className="absolute left-6 flex items-center justify-center">
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    </div>
                    {googleLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Redirecting...
                      </div>
                    ) : (
                      'Log in with Google'
                    )}
                  </Button>
                </div>

                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500 font-medium">or</span>
                  </div>
                </div>

                {authMode === 'signup' ? (
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        placeholder="First name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        className="h-12 bg-[#F7F7F7] border-gray-200 rounded-xl focus-visible:ring-blue-500 text-sm px-4"
                      />
                      <Input
                        placeholder="Last name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        className="h-12 bg-[#F7F7F7] border-gray-200 rounded-xl focus-visible:ring-blue-500 text-sm px-4"
                      />
                    </div>

                    <div className="relative">
                      <Input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-12 pr-10 bg-[#F7F7F7] border-gray-200 rounded-xl focus-visible:ring-blue-500 text-sm px-4"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <User className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>

                    <div className="relative">
                      <Input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-12 pr-10 bg-[#F7F7F7] border-gray-200 rounded-xl focus-visible:ring-blue-500 text-sm px-4"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Lock className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 px-1">
                      Password must be at least 8 characters with uppercase, lowercase, and numbers
                    </p>

                    <div className="flex items-center gap-2.5 pt-1">
                      <input
                        type="checkbox"
                        id="terms"
                        checked={agreeToTerms}
                        onChange={(e) => setAgreeToTerms(e.target.checked)}
                        className="w-5 h-5 accent-blue-500 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                      <label htmlFor="terms" className="text-sm text-gray-500 cursor-pointer select-none">
                        I agree to the Terms & privacy
                      </label>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white h-12 text-base font-semibold rounded-xl mt-2 transition-all"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : 'Sign up'}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="relative">
                      <Input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-12 pr-10 bg-[#F7F7F7] border-gray-200 rounded-xl focus-visible:ring-blue-500 text-sm px-4"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <User className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                    <div className="relative">
                      <Input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-12 pr-10 bg-[#F7F7F7] border-gray-200 rounded-xl focus-visible:ring-blue-500 text-sm px-4"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Lock className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white h-12 text-base font-semibold rounded-xl mt-2 transition-all"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : 'Sign in'}
                    </Button>
                  </form>
                )}

                <div className="text-center mt-8">
                  {authMode === 'signup' ? (
                    <p className="text-gray-500 text-sm">
                      Have an account?{' '}
                      <button onClick={() => setAuthMode('signin')} className="text-blue-600 font-semibold hover:underline">
                        Sign in
                      </button>
                    </p>
                  ) : (
                    <p className="text-gray-500 text-sm">
                      Don't have an account?{' '}
                      <button onClick={() => setAuthMode('signup')} className="text-blue-600 font-semibold hover:underline">
                        Sign up
                      </button>
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Email Verification */}
            {step === 1 && pendingVerification && (
              <motion.div
                key="verification"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-md mx-auto w-full"
              >
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Verify Your Email</h2>
                <p className="text-gray-500 mb-8">Enter the code sent to {email}</p>
                <form onSubmit={handleVerifyEmail} className="space-y-6">
                  <Input
                    type="text"
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    maxLength={6}
                    className="py-6 text-center text-3xl tracking-[1em] bg-[#F7F7F7] border-gray-100 rounded-xl"
                  />
                  <Button type="submit" disabled={loading || verificationCode.length !== 6} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-6 text-lg font-semibold rounded-2xl">
                    {loading ? <Loader2 className="animate-spin" /> : 'Verify Email'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setPendingVerification(false)} className="w-full">Back</Button>
                </form>
              </motion.div>
            )}

            {/* Step 2: Recruiter Type */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-md mx-auto w-full"
              >
                <h2 className="text-3xl font-bold text-gray-900 mb-2">What kind of recruiter are you?</h2>
                <p className="text-gray-500 mb-8">Select the option that best describes you</p>
                <div className="space-y-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    onClick={() => handleRecruiterTypeSelection('recruitment-team')}
                    className={`w-full p-6 border rounded-2xl text-left transition-all ${
                      recruiterType === 'recruitment-team' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        recruiterType === 'recruitment-team' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'
                      }`}>
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">University Recruiter</h3>
                        <p className="text-gray-500 text-sm">I am recruiting for my university</p>
                      </div>
                    </div>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    onClick={() => handleRecruiterTypeSelection('recruitment-agency')}
                    className={`w-full p-6 border rounded-2xl text-left transition-all ${
                      recruiterType === 'recruitment-agency' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        recruiterType === 'recruitment-agency' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'
                      }`}>
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">Recruitment Agency</h3>
                        <p className="text-gray-500 text-sm">I hire for different universities</p>
                      </div>
                    </div>
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Step 3: University Website */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-md mx-auto w-full h-full flex flex-col pt-10"
              >
                <div className="flex-1 flex flex-col justify-start">
                  <h2 className="text-[32px] font-bold text-gray-900 mb-8">University website</h2>
                  
                  <div className="space-y-2">
                    <div className="relative flex items-center border border-blue-200 rounded-full overflow-hidden bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all h-14">
                      <div className="h-full px-6 bg-slate-50 border-r border-blue-100 text-gray-900 font-medium flex items-center select-none text-base">
                        https://
                      </div>
                      <input
                        type="text"
                        placeholder="Enter the University website url"
                        value={universityWebsite}
                        onChange={handleWebsiteChange}
                        className="flex-1 bg-transparent border-none focus:ring-0 px-5 h-full text-gray-900 placeholder:text-gray-400 outline-none w-full text-base"
                      />
                      <AnimatePresence>
                        {websiteValid && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="mr-4 bg-green-500 rounded-full p-1"
                          >
                            <Check className="w-4 h-4 text-white" strokeWidth={3} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    {universityWebsite && !websiteValid && (
                      <p className="text-red-500 text-xs ml-2">Please enter a valid URL</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 pb-2">
                  <Button
                    onClick={() => setStep(2)}
                    variant="outline"
                    className="flex-1 h-12 rounded-full text-sm font-semibold border-gray-200 hover:bg-gray-50"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleUniversityWebsite}
                    disabled={!websiteValid}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white h-12 rounded-full text-sm font-semibold"
                  >
                    Next
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 4: University Details */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-md mx-auto w-full"
              >
                <h2 className="text-3xl font-bold text-gray-900 mb-2">University Details</h2>
                <p className="text-gray-500 mb-8">Tell us more about your university</p>

                <div className="space-y-6">
                  {/* Logo Upload */}
                  <div className="border border-gray-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between bg-white gap-4 sm:gap-0">
                    <div className="flex items-center gap-3">
                      {universityLogo ? (
                        <img src={universityLogo} alt="Logo" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                      )}
                      <span className="text-gray-700 font-medium">University Logo</span>
                    </div>
                    <Button
                      variant="outline"
                      className="text-blue-600 border-blue-200 hover:bg-blue-50 rounded-xl px-4 h-10"
                      onClick={() => {
                        const input = document.createElement('input')
                        input.type = 'file'
                        input.accept = 'image/*'
                        input.onchange = (e: any) => {
                          const file = e.target?.files?.[0]
                          if (file) {
                            const reader = new FileReader()
                            reader.onloadend = () => setUniversityLogo(reader.result as string)
                            reader.readAsDataURL(file)
                          }
                        }
                        input.click()
                      }}
                    >
                      Upload <Upload className="w-4 h-4 ml-2" />
                    </Button>
                  </div>

                  {/* Name */}
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600" />
                    <Input
                      type="text"
                      placeholder="University name*"
                      value={universityName}
                      onChange={(e) => setUniversityName(e.target.value)}
                      className="pl-12 py-6 bg-white border-gray-200 rounded-2xl focus-visible:ring-blue-500 text-base"
                    />
                  </div>

                  {/* About */}
                  <textarea
                    placeholder="About your University"
                    value={universityAbout}
                    onChange={(e) => setUniversityAbout(e.target.value)}
                    rows={5}
                    className="w-full border border-gray-200 rounded-2xl p-4 text-base resize-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 placeholder:text-gray-400"
                  />

                  <div className="flex gap-4 pt-2">
                    <Button
                      onClick={() => setStep(3)}
                      variant="outline"
                      className="flex-1 py-6 rounded-2xl text-base font-semibold border-gray-200"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleUniversityDetails}
                      disabled={!universityName || loading}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-6 rounded-2xl text-base font-semibold"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : 'Next'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  )
}
