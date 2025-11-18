'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSignUp, useSignIn } from '@clerk/nextjs'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Building2, Users, Check, Loader2 } from 'lucide-react'

type RecruiterType = 'recruitment-team' | 'recruitment-agency' | null
type AuthMode = 'signup' | 'signin'

export default function OnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp()
  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn()
  const [authMode, setAuthMode] = useState<AuthMode>('signup')
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Check URL params for auth mode
  useEffect(() => {
    const mode = searchParams?.get('mode')
    if (mode === 'signin') {
      setAuthMode('signin')
    }
  }, [searchParams])
  
  // Form data
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [recruiterType, setRecruiterType] = useState<RecruiterType>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [pendingVerification, setPendingVerification] = useState(false)

  // Sign In handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!signInLoaded) return

    setLoading(true)

    try {
      const result = await signIn?.create({
        identifier: email,
        password,
      })

      if (result?.status === 'complete') {
        await setActiveSignIn({ session: result.createdSessionId })
        router.push('/dashboard')
      }
    } catch (err: any) {
      console.error('Sign in error:', err)
      toast.error(err.errors?.[0]?.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  // Sign Up handler
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!signUpLoaded) return
    
    if (!agreeToTerms) {
      toast.error('Please agree to the terms & privacy policy')
      return
    }

    setLoading(true)

    try {
      await signUp?.create({
        firstName,
        lastName,
        emailAddress: email,
        password,
      })

      // Send email verification code
      await signUp?.prepareEmailAddressVerification({ strategy: 'email_code' })

      setPendingVerification(true)
      toast.success('Verification code sent to your email!')
    } catch (err: any) {
      console.error('Sign up error:', err)
      toast.error(err.errors?.[0]?.message || 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  // Email verification handler
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!signUpLoaded) return

    setLoading(true)

    try {
      const completeSignUp = await signUp?.attemptEmailAddressVerification({
        code: verificationCode,
      })

      if (completeSignUp?.status === 'complete') {
        // Move to recruiter type selection
        setStep(2)
        setPendingVerification(false)
        toast.success('Email verified! Please select your role.')
      }
    } catch (err: any) {
      console.error('Verification error:', err)
      toast.error(err.errors?.[0]?.message || 'Invalid verification code')
    } finally {
      setLoading(false)
    }
  }

  // Recruiter type selection handler
  const handleRecruiterTypeSelection = async (type: RecruiterType) => {
    setRecruiterType(type)
    setLoading(true)

    try {
      // Store recruiter type in user metadata
      await signUp?.update({
        unsafeMetadata: {
          recruiterType: type
        }
      })

      // Move to completion step
      setStep(3)
      toast.success('Profile information saved!')
    } catch (err: any) {
      console.error('Error saving profile:', err)
      toast.error('Failed to save profile information')
    } finally {
      setLoading(false)
    }
  }

  // Complete onboarding
  const handleComplete = async () => {
    setLoading(true)
    
    try {
      if (signUp?.status === 'complete' && setActiveSignUp) {
        await setActiveSignUp({ session: signUp.createdSessionId })
        router.push('/dashboard')
      } else {
        toast.error('Please complete all steps')
      }
    } catch (err: any) {
      console.error('Error completing setup:', err)
      toast.error('Failed to complete setup')
    } finally {
      setLoading(false)
    }
  }

  // Google OAuth handler
  const handleGoogleSignIn = async () => {
    if (!signUpLoaded) return

    try {
      await signUp?.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/dashboard',
      })
    } catch (err: any) {
      console.error('Google sign in error:', err)
      toast.error('Failed to sign in with Google')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="flex flex-col lg:flex-row">
            {/* Left Panel - Branding */}
            <div className="lg:w-1/2 bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 p-12 text-white relative overflow-hidden">
              <div className="relative z-10">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mb-8"
                >
                  <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm mb-8">
                    <span className="animate-pulse">✨</span>
                    Join us to Interview
                  </div>
                  
                  <h1 className="text-5xl font-bold mb-6 leading-tight">
                    Start your Journey
                  </h1>
                  
                  <p className="text-xl text-white/90 mb-12">
                    Follow these simple steps to set up your account
                  </p>
                </motion.div>

                {/* Steps Indicator */}
                <div className="space-y-6">
                  {[
                    { num: 1, title: 'Register your', subtitle: 'account' },
                    { num: 2, title: 'Set up your profile', subtitle: 'information' },
                    { num: 3, title: 'Verify your identity', subtitle: 'through passport' }
                  ].map((item, idx) => (
                    <motion.div
                      key={item.num}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + idx * 0.1 }}
                      className={`flex items-start gap-4 p-4 rounded-xl transition-all ${
                        step >= item.num 
                          ? 'bg-white/20 backdrop-blur-sm' 
                          : 'bg-white/5'
                      }`}
                    >
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        step > item.num
                          ? 'bg-green-400 text-green-900'
                          : step === item.num
                          ? 'bg-white text-indigo-600'
                          : 'bg-white/20 text-white/60'
                      }`}>
                        {step > item.num ? <Check className="w-5 h-5" /> : item.num}
                      </div>
                      <div>
                        <p className="font-semibold text-lg">{item.title}</p>
                        <p className="text-white/80 text-sm">{item.subtitle}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Decorative circles */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-400/20 rounded-full translate-y-48 -translate-x-48 blur-3xl" />
            </div>

            {/* Right Panel - Form Content */}
            <div className="lg:w-1/2 p-12">
              <AnimatePresence mode="wait">
                {step === 1 && !pendingVerification && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                      {authMode === 'signup' ? 'Get Started Now' : 'Welcome Back'}
                    </h2>
                    <p className="text-gray-500 mb-8">
                      {authMode === 'signup' ? 'Create your account to begin' : 'Sign in to your account'}
                    </p>

                    {/* Google Sign In */}
                    <Button
                      variant="outline"
                      className="w-full mb-6 py-6 border-2 hover:bg-gray-50"
                      onClick={handleGoogleSignIn}
                      type="button"
                    >
                      <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Continue with Google
                    </Button>

                    <div className="relative mb-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white text-gray-500">or</span>
                      </div>
                    </div>

                    {/* Sign Up Form */}
                    {authMode === 'signup' && (
                      <form onSubmit={handleSignUp} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <Input
                            placeholder="First name"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
                            className="py-6"
                          />
                          <Input
                            placeholder="Last name"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            required
                            className="py-6"
                          />
                        </div>

                        <div className="relative">
                          <Input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="py-6 pr-10"
                          />
                          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>

                        <div className="relative">
                          <Input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="py-6 pr-10"
                          />
                          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="terms"
                            checked={agreeToTerms}
                            onChange={(e) => setAgreeToTerms(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <label htmlFor="terms" className="text-sm text-gray-600">
                            I agree to the Terms & privacy
                          </label>
                        </div>

                        <Button
                          type="submit"
                          disabled={loading}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 text-lg font-semibold rounded-xl"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                              Creating account...
                            </>
                          ) : (
                            'Sign up'
                          )}
                        </Button>
                      </form>
                    )}

                    {/* Sign In Form */}
                    {authMode === 'signin' && (
                      <form onSubmit={handleSignIn} className="space-y-4">
                        <div className="relative">
                          <Input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="py-6 pr-10"
                          />
                          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>

                        <div className="relative">
                          <Input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="py-6 pr-10"
                          />
                          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>

                        <Button
                          type="submit"
                          disabled={loading}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 text-lg font-semibold rounded-xl"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                              Signing in...
                            </>
                          ) : (
                            'Sign in'
                          )}
                        </Button>
                      </form>
                    )}

                    <p className="text-center text-sm text-gray-600 mt-6">
                      {authMode === 'signup' ? (
                        <>
                          Have a account?{' '}
                          <button
                            type="button"
                            onClick={() => setAuthMode('signin')}
                            className="text-indigo-600 font-semibold hover:underline"
                          >
                            Sign in
                          </button>
                        </>
                      ) : (
                        <>
                          Don't have an account?{' '}
                          <button
                            type="button"
                            onClick={() => setAuthMode('signup')}
                            className="text-indigo-600 font-semibold hover:underline"
                          >
                            Sign up
                          </button>
                        </>
                      )}
                    </p>
                  </motion.div>
                )}

                {/* Email Verification Step */}
                {step === 1 && pendingVerification && (
                  <motion.div
                    key="verification"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Verify Your Email</h2>
                    <p className="text-gray-500 mb-8">
                      We sent a verification code to <strong>{email}</strong>
                    </p>

                    <form onSubmit={handleVerifyEmail} className="space-y-4">
                      <div className="relative">
                        <Input
                          type="text"
                          placeholder="Enter 6-digit code"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          required
                          maxLength={6}
                          className="py-6 text-center text-2xl tracking-widest"
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={loading || verificationCode.length !== 6}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 text-lg font-semibold rounded-xl"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          'Verify Email'
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setPendingVerification(false)}
                        className="w-full"
                      >
                        Back
                      </Button>
                    </form>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">What kind of recruiter are you?</h2>
                    <p className="text-gray-500 mb-8">Select the option that best describes you</p>

                    <div className="space-y-4">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleRecruiterTypeSelection('recruitment-team')}
                        disabled={loading}
                        className={`w-full p-6 border-2 rounded-2xl transition-all text-left ${
                          recruiterType === 'recruitment-team'
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-gray-200 hover:border-indigo-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            recruiterType === 'recruitment-team' 
                              ? 'bg-indigo-600' 
                              : 'bg-indigo-100'
                          }`}>
                            <Users className={`w-6 h-6 ${
                              recruiterType === 'recruitment-team' 
                                ? 'text-white' 
                                : 'text-indigo-600'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-gray-900 mb-1">Recruitment team</h3>
                            <p className="text-gray-500 text-sm">I'm hiring for my company</p>
                          </div>
                          {recruiterType === 'recruitment-team' && (
                            <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleRecruiterTypeSelection('recruitment-agency')}
                        disabled={loading}
                        className={`w-full p-6 border-2 rounded-2xl transition-all text-left ${
                          recruiterType === 'recruitment-agency'
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-gray-200 hover:border-indigo-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            recruiterType === 'recruitment-agency' 
                              ? 'bg-indigo-600' 
                              : 'bg-indigo-100'
                          }`}>
                            <Building2 className={`w-6 h-6 ${
                              recruiterType === 'recruitment-agency' 
                                ? 'text-white' 
                                : 'text-indigo-600'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-gray-900 mb-1">Recruitment Agency</h3>
                            <p className="text-gray-500 text-sm">I'm hiring for another company</p>
                          </div>
                          {recruiterType === 'recruitment-agency' && (
                            <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </div>
                      </motion.button>
                    </div>

                    <Button
                      onClick={() => setStep(1)}
                      variant="ghost"
                      className="w-full mt-6"
                    >
                      Back
                    </Button>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="text-center py-8"
                  >
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Check className="w-10 h-10 text-green-600" />
                    </div>
                    
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Setup Complete!</h2>
                    <p className="text-gray-500 mb-8">Your account is ready to use</p>

                    <div className="bg-indigo-50 rounded-2xl p-6 mb-8">
                      <p className="text-sm text-gray-600 mb-2">Account Type</p>
                      <p className="text-lg font-semibold text-gray-900 capitalize">
                        {recruiterType?.replace('-', ' ')}
                      </p>
                    </div>

                    <Button
                      onClick={handleComplete}
                      disabled={loading}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 text-lg font-semibold rounded-xl"
                    >
                      {loading ? 'Setting up...' : 'Go to Dashboard'}
                    </Button>

                    <Button
                      onClick={() => setStep(2)}
                      variant="ghost"
                      className="w-full mt-4"
                    >
                      Back
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
